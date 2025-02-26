import {
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type IBrowserService,
  type IVideoService,
  logger,
  type Media,
  type Memory,
  ServiceType,
  stringToUuid,
  type UUID,
  ChannelType
} from "@elizaos/core";
import {
  ChannelType as DiscordChannelType,
  type Client,
  type Message as DiscordMessage,
  type TextChannel,
} from "discord.js";
import { AttachmentManager } from "./attachments";
import { canSendMessage, sendMessageInChunks } from "./utils";

export class MessageManager {
  private client: Client;
  private runtime: IAgentRuntime;
  private attachmentManager: AttachmentManager;
  private getChannelType: (channelId: string) => Promise<ChannelType>;
  constructor(discordClient: any) {
    this.client = discordClient.client;
    this.runtime = discordClient.runtime;
    this.attachmentManager = new AttachmentManager(this.runtime);
    this.getChannelType = discordClient.getChannelType;
  }

  async handleMessage(message: DiscordMessage) {
    if (
      this.runtime.character.settings?.discord?.allowedChannelIds &&
      !this.runtime.character.settings.discord.allowedChannelIds.some(
        (id: string) => id === message.channel.id
      )
    ) {
      return;
    }

    if (message.interaction || message.author.id === this.client.user?.id) {
      return;
    }

    if (
      this.runtime.character.settings?.discord?.shouldIgnoreBotMessages &&
      message.author?.bot
    ) {
      return;
    }

    if (
      this.runtime.character.settings?.discord?.shouldIgnoreDirectMessages &&
      message.channel.type === DiscordChannelType.DM
    ) {
      return;
    }

    const userId = message.author.id as UUID;
    const userIdUUID = stringToUuid(`${message.author.id}-${this.runtime.agentId}`);
    const userName = message.author.username;
    const name = message.author.displayName;
    const channelId = message.channel.id;
    const roomId = stringToUuid(`${channelId}-${this.runtime.agentId}`);

    let type: ChannelType;
    let serverId: string | undefined;

    if (message.guild) {
      const guild = await message.guild.fetch();
      type = await this.getChannelType(message.channel.id);
      serverId = guild.id;
    } else {
      type = ChannelType.DM;
      serverId = undefined;
    }

    await this.runtime.ensureConnection({
      userId: userIdUUID,
      roomId,
      userName,
      userScreenName: name,
      source: "discord",
      channelId: message.channel.id,
      serverId,
      type,
    });

    try {
      const canSendResult = canSendMessage(message.channel);
      if (!canSendResult.canSend) {
        return logger.warn(
          `Cannot send message to channel ${message.channel}`,
          canSendResult
        );
      }

      const { processedContent, attachments } = await this.processMessage(
        message
      );

      const audioAttachments = message.attachments.filter((attachment) =>
        attachment.contentType?.startsWith("audio/")
      );

      if (audioAttachments.size > 0) {
        const processedAudioAttachments =
          await this.attachmentManager.processAttachments(audioAttachments);
        attachments.push(...processedAudioAttachments);
      }

      const userIdUUID = stringToUuid(`${message.author.id}-${this.runtime.agentId}`);
      const messageId = stringToUuid(`${message.id}-${this.runtime.agentId}`);

      const newMessage: Memory = {
        id: messageId,
        userId: userIdUUID,
        agentId: this.runtime.agentId,
        roomId: roomId,
        content: {
          name: name,
          userName: userName,
          text: processedContent,
          attachments: attachments,
          source: "discord",
          url: message.url,
          inReplyTo: message.reference?.messageId
            ? stringToUuid(message.reference.messageId)
            : undefined,
        },
        createdAt: message.createdTimestamp,
      };

      const callback: HandlerCallback = async (
        content: Content,
        files: any[]
      ) => {
        try {
          if (message.id && !content.inReplyTo) {
            content.inReplyTo = stringToUuid(
              `${message.id}-${this.runtime.agentId}`
            );
          }
          const messages = await sendMessageInChunks(
            message.channel as TextChannel,
            content.text,
            message.id,
            files
          );

          const memories: Memory[] = [];
          for (const m of messages) {
            let action = content.action;
            if (messages.length > 1 && m !== messages[messages.length - 1]) {
              action = "CONTINUE";
            }

            const memory: Memory = {
              id: stringToUuid(`${m.id}-${this.runtime.agentId}`),
              userId: this.runtime.agentId,
              agentId: this.runtime.agentId,
              content: {
                ...content,
                action,
                inReplyTo: messageId,
                url: m.url,
              },
              roomId,
              createdAt: m.createdTimestamp,
            };
            memories.push(memory);
          }

          for (const m of memories) {
            await this.runtime.messageManager.createMemory(m);
          }
          return memories;
        } catch (error) {
          console.error("Error sending message:", error);
          return [];
        }
      };

      this.runtime.emitEvent(["DISCORD_MESSAGE_RECEIVED", "MESSAGE_RECEIVED"], {
        runtime: this.runtime,
        message: newMessage,
        callback,
      });
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  async processMessage(
    message: DiscordMessage
  ): Promise<{ processedContent: string; attachments: Media[] }> {
    let processedContent = message.content;
    let attachments: Media[] = [];

    const mentionRegex = /<@!?(\d+)>/g;
    processedContent = processedContent.replace(
      mentionRegex,
      (match, userId) => {
        const user = message.mentions.users.get(userId);
        if (user) {
          return `${user.username} (@${userId})`;
        }
        return match;
      }
    );

    const codeBlockRegex = /```([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(processedContent))) {
      const codeBlock = match[1];
      const lines = codeBlock.split("\n");
      const title = lines[0];
      const description = lines.slice(0, 3).join("\n");
      const attachmentId = `code-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`.slice(-5);
      attachments.push({
        id: attachmentId,
        url: "",
        title: title || "Code Block",
        source: "Code",
        description: description,
        text: codeBlock,
      });
      processedContent = processedContent.replace(
        match[0],
        `Code Block (${attachmentId})`
      );
    }

    if (message.attachments.size > 0) {
      attachments = await this.attachmentManager.processAttachments(
        message.attachments
      );
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = processedContent.match(urlRegex) || [];

    for (const url of urls) {
      if (
        this.runtime
          .getService<IVideoService>(ServiceType.VIDEO)
          ?.isVideoUrl(url)
      ) {
        const videoService = this.runtime.getService<IVideoService>(
          ServiceType.VIDEO
        );
        if (!videoService) {
          throw new Error("Video service not found");
        }
        const videoInfo = await videoService.processVideo(url, this.runtime);

        attachments.push({
          id: `youtube-${Date.now()}`,
          url: url,
          title: videoInfo.title,
          source: "YouTube",
          description: videoInfo.description,
          text: videoInfo.text,
        });
      } else {
        const browserService = this.runtime.getService<IBrowserService>(
          ServiceType.BROWSER
        );
        if (!browserService) {
          throw new Error("Browser service not found");
        }

        const { title, description: summary } =
          await browserService.getPageContent(url, this.runtime);

        attachments.push({
          id: `webpage-${Date.now()}`,
          url: url,
          title: title || "Web Page",
          source: "Web",
          description: summary,
          text: summary,
        });
      }
    }

    return { processedContent, attachments };
  }

  async fetchBotName(botToken: string) {
    const url = "https://discord.com/api/v10/users/@me";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching bot details: ${response.statusText}`);
    }

    const data = await response.json();
    return (data as { username: string }).username;
  }
}
