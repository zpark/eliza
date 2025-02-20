import {
  ChannelType,
  HandlerCallback,
  logger,
  Memory,
  stringToUuid,
  UUID,
  type Character,
  type Client as ElizaClient,
  type IAgentRuntime,
  type Plugin,
} from "@elizaos/core";
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  TextChannel,
  type Guild,
  type MessageReaction,
  type User,
  ChannelType as DiscordChannelType,
  OAuth2Guild,
} from "discord.js";
import { EventEmitter } from "events";
import chatWithAttachments from "./actions/chatWithAttachments.ts";
import downloadMedia from "./actions/downloadMedia.ts";
import joinVoice from "./actions/voiceJoin.ts";
import leaveVoice from "./actions/voiceLeave.ts";
import reply from "./actions/reply.ts";
import summarize from "./actions/summarizeConversation.ts";
import transcribe_media from "./actions/transcribeMedia.ts";
import { DISCORD_CLIENT_NAME } from "./constants.ts";
import { MessageManager } from "./messages.ts";
import channelStateProvider from "./providers/channelState.ts";
import voiceStateProvider from "./providers/voiceState.ts";
import { DiscordTestSuite } from "./test-suite.ts";
import type { IDiscordClient } from "./types.ts";
import { VoiceManager } from "./voice.ts";

interface RoomData {
  channelId: string;
  serverId: string;
}

interface AuthorData {
  userId: string;
  userName: string;
  displayName: string;
}

export class DiscordClient extends EventEmitter implements IDiscordClient {
  apiToken: string;
  client: Client;
  runtime: IAgentRuntime;
  character: Character;
  messageManager: MessageManager;
  voiceManager: VoiceManager;

  constructor(runtime: IAgentRuntime) {
    super();

    logger.log("Discord client constructor was engaged");

    this.apiToken = runtime.getSetting("DISCORD_API_TOKEN") as string;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.Reaction,
      ],
    });

    this.runtime = runtime;
    this.voiceManager = new VoiceManager(this);
    this.messageManager = new MessageManager(this);

    this.client.once(Events.ClientReady, this.onClientReady.bind(this));
    this.client.login(this.apiToken);

    this.setupEventListeners();

    // give it to the 
    const ensureAllServersExist = async (runtime: IAgentRuntime) => {
      const guilds = await this.client.guilds.fetch();
      for (const [, guild] of guilds) {
        await this.ensureAllChannelsExist(runtime, guild);
      }
    }

    ensureAllServersExist(this.runtime);
  }

  async ensureAllChannelsExist(runtime: IAgentRuntime, guild: OAuth2Guild) {
    const guildChannels = await guild.fetch();
    // for channel in channels
    for (const [, channel] of guildChannels.channels.cache) {
      const roomId = stringToUuid(channel.id + "-" + runtime.agentId);
      const room = await runtime.getRoom(roomId);
      // if the room already exists, skip
      if (room) {
        continue;
      }
      const worldId = stringToUuid(guild.id + "-" + runtime.agentId)
      await runtime.ensureWorldExists({id: worldId, name: guild.name, serverId: guild.id, agentId: runtime.agentId});
      await runtime.ensureRoomExists({id: roomId, name: channel.name, source: "discord", type: ChannelType.GROUP, channelId: channel.id, serverId: guild.id, worldId});
    }
  }

  private setupEventListeners() {
    // When joining to a new server
    this.client.on("guildCreate", this.handleGuildCreate.bind(this));

    this.client.on(
      Events.MessageReactionAdd,
      this.handleReactionAdd.bind(this)
    );
    this.client.on(
      Events.MessageReactionRemove,
      this.handleReactionRemove.bind(this)
    );

    // Handle voice events with the voice manager
    this.client.on(
      "voiceStateUpdate",
      this.voiceManager.handleVoiceStateUpdate.bind(this.voiceManager)
    );
    this.client.on(
      "userStream",
      this.voiceManager.handleUserStream.bind(this.voiceManager)
    );

    // Handle a new message with the message manager
    this.client.on(
      Events.MessageCreate,
      this.messageManager.handleMessage.bind(this.messageManager)
    );

    // Handle a new interaction
    this.client.on(
      Events.InteractionCreate,
      this.handleInteractionCreate.bind(this)
    );
  }

  async stop() {
    try {
      // disconnect websocket
      // this unbinds all the listeners
      await this.client.destroy();
    } catch (e) {
      logger.error("client-discord instance stop err", e);
    }
  }

  private async onClientReady(readyClient: { user: { tag: any; id: any } }) {
    logger.success(`Logged in as ${readyClient.user?.tag}`);

    // Register slash commands
    const commands = [
      {
        name: "joinchannel",
        description: "Join a voice channel",
        options: [
          {
            name: "channel",
            type: 7, // CHANNEL type
            description: "The voice channel to join",
            required: true,
            channel_types: [2], // GuildVoice type
          },
        ],
      },
      {
        name: "leavechannel",
        description: "Leave the current voice channel",
      },
    ];

    try {
      await this.client.application?.commands.set(commands);
      logger.success("Slash commands registered");
    } catch (error) {
      console.error("Error registering slash commands:", error);
    }

    // Required permissions for the bot
    const requiredPermissions = [
      // Text Permissions
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.SendMessagesInThreads,
      PermissionsBitField.Flags.CreatePrivateThreads,
      PermissionsBitField.Flags.CreatePublicThreads,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.AddReactions,
      PermissionsBitField.Flags.UseExternalEmojis,
      PermissionsBitField.Flags.UseExternalStickers,
      PermissionsBitField.Flags.MentionEveryone,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      // Voice Permissions
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak,
      PermissionsBitField.Flags.UseVAD,
      PermissionsBitField.Flags.PrioritySpeaker,
    ].reduce((a, b) => a | b, 0n);

    logger.success("Use this URL to add the bot to your server:");
    logger.success(
      `https://discord.com/api/oauth2/authorize?client_id=${readyClient.user?.id}&permissions=${requiredPermissions}&scope=bot%20applications.commands`
    );
    await this.onReady();
  }

  async getChannelType(channelId: string): Promise<ChannelType> {
    const channel = await this.client.channels.fetch(channelId);
    switch (channel.type) {
      case DiscordChannelType.DM:
        return ChannelType.DM;
      case DiscordChannelType.GuildText:
        return ChannelType.GROUP;
      case DiscordChannelType.GuildVoice:
        return ChannelType.VOICE_GROUP;
    }
  }

  async handleReactionAdd(reaction: MessageReaction, user: User) {
    try {
      logger.log("Reaction added");

      // Early returns
      if (!reaction || !user) {
        logger.warn("Invalid reaction or user");
        return;
      }

      // Get emoji info
      let emoji = reaction.emoji.name;
      if (!emoji && reaction.emoji.id) {
        emoji = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
      }

      // Fetch full message if partial
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          logger.error("Failed to fetch partial reaction:", error);
          return;
        }
      }

      // Generate IDs with timestamp to ensure uniqueness
      const timestamp = Date.now();
      const roomId = stringToUuid(
        `${reaction.message.channel.id}-${this.runtime.agentId}`
      );
      const userIdUUID = stringToUuid(`${user.id}-${this.runtime.agentId}`);
      const reactionUUID = stringToUuid(
        `${reaction.message.id}-${user.id}-${emoji}-${timestamp}-${this.runtime.agentId}`
      );

      // Validate IDs
      if (!userIdUUID || !roomId) {
        logger.error("Invalid user ID or room ID", {
          userIdUUID,
          roomId,
        });
        return;
      }

      // Process message content
      const messageContent = reaction.message.content || "";
      const truncatedContent =
        messageContent.length > 50
          ? `${messageContent.substring(0, 50)}...`
          : messageContent;
      const reactionMessage = `*Added <${emoji}> to: "${truncatedContent}"*`;

      // Get user info
      const userName = reaction.message.author?.username || "unknown";
      const name = reaction.message.author?.displayName || userName;

      // TODO: Get the type of the channel

      await this.runtime.ensureConnection({
        userId: userIdUUID,
        roomId,
        userName,
        userScreenName: name,
        source: "discord",
        channelId: reaction.message.channel.id,
        serverId: reaction.message.guild?.id,
        type: await this.getChannelType(reaction.message.channel.id),
      });

      const memory: Memory = {
        id: reactionUUID,
        userId: userIdUUID,
        agentId: this.runtime.agentId,
        content: {
          name,
          userName,
          text: reactionMessage,
          source: "discord",
          inReplyTo: stringToUuid(
            `${reaction.message.id}-${this.runtime.agentId}`
          ),
        },
        roomId,
        createdAt: timestamp,
      };

      const callback: HandlerCallback = async (content) => {
        if (!reaction.message.channel) {
          logger.error("No channel found for reaction message");
          return;
        }
        await (reaction.message.channel as TextChannel).send(content.text);
        return [];
      };

      this.runtime.emitEvent(
        ["DISCORD_REACTION_RECEIVED", "REACTION_RECEIVED"],
        {
          runtime: this.runtime,
          message: memory,
          callback,
        }
      );
    } catch (error) {
      logger.error("Error handling reaction:", error);
    }
  }

  async handleReactionRemove(reaction: MessageReaction, user: User) {
    try {
      logger.log("Reaction removed");

      let emoji = reaction.emoji.name;
      if (!emoji && reaction.emoji.id) {
        emoji = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
      }

      // Fetch the full message if it's a partial
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          logger.error(
            "Something went wrong when fetching the message:",
            error
          );
          return;
        }
      }

      const messageContent = reaction.message.content || "";
      const truncatedContent =
        messageContent.length > 50
          ? messageContent.substring(0, 50) + "..."
          : messageContent;

      const reactionMessage = `*Removed <${emoji}> from: "${truncatedContent}"*`;

      const roomId = stringToUuid(
        reaction.message.channel.id + "-" + this.runtime.agentId
      );
      const userIdUUID = stringToUuid(user.id);
      const reactionUUID = stringToUuid(
        `${reaction.message.id}-${user.id}-${emoji}-removed-${this.runtime.agentId}`
      );

      const userName = reaction.message.author?.username || "unknown";
      const name = reaction.message.author?.displayName || userName;


      await this.runtime.ensureConnection({
        userId: userIdUUID,
        roomId,
        userName,
        userScreenName: name,
        source: "discord",
        channelId: reaction.message.channel.id,
        serverId: reaction.message.guild?.id,
        type: await this.getChannelType(reaction.message.channel.id),
      });

      const memory: Memory = {
        id: reactionUUID,
        userId: userIdUUID,
        agentId: this.runtime.agentId,
        content: {
          name,
          userName,
          text: reactionMessage,
          source: "discord",
          inReplyTo: stringToUuid(
            `${reaction.message.id}-${this.runtime.agentId}`
          ),
        },
        roomId,
        createdAt: Date.now(),
      };

      const callback: HandlerCallback = async (content) => {
        if (!reaction.message.channel) {
          logger.error("No channel found for reaction message");
          return;
        }
        await (reaction.message.channel as TextChannel).send(content.text);
        return [];
      };

      this.runtime.emitEvent(["DISCORD_REACTION_EVENT", "REACTION_RECEIVED"], {
        runtime: this.runtime,
        message: memory,
        callback,
      });
    } catch (error) {
      logger.error("Error handling reaction removal:", error);
    }
  }

  private async handleGuildCreate(guild: Guild) {
    logger.log(`Joined guild ${guild.name}`);
    const fullGuild = await guild.fetch();
    this.voiceManager.scanGuild(guild);
    this.runtime.emitEvent("DISCORD_JOIN_SERVER", {
      runtime: this.runtime,
      guild: fullGuild,
    });
  }

  private async handleInteractionCreate(interaction: any) {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
      case "joinchannel":
        await this.voiceManager.handleJoinChannelCommand(interaction);
        break;
      case "leavechannel":
        await this.voiceManager.handleLeaveChannelCommand(interaction);
        break;
    }
  }

  private async onReady() {
    logger.log("DISCORD ON READY");
    const guilds = await this.client.guilds.fetch();
    for (const [, guild] of guilds) {
      const fullGuild = await guild.fetch();
      await this.voiceManager.scanGuild(fullGuild);
      // send in 1 second
      setTimeout(async () => {
        // for each server the client is in, fire a connected event
        for (const [, guild] of guilds) {
          const fullGuild = await guild.fetch();

          logger.log("DISCORD SERVER CONNECTED", fullGuild);
          this.runtime.emitEvent("DISCORD_SERVER_CONNECTED", { runtime: this.runtime, guild: fullGuild });
        }
      }, 1000);
    }

    this.client.emit("voiceManagerReady");
  }
}

const DiscordClientInterface: ElizaClient = {
  name: DISCORD_CLIENT_NAME,
  start: async (runtime: IAgentRuntime) => new DiscordClient(runtime),
};

const discordPlugin: Plugin = {
  name: "discord",
  description: "Discord client plugin",
  clients: [DiscordClientInterface],
  actions: [
    reply,
    chatWithAttachments,
    downloadMedia,
    joinVoice,
    leaveVoice,
    summarize,
    transcribe_media,
  ],
  providers: [channelStateProvider, voiceStateProvider],
  tests: [new DiscordTestSuite()],
};

export default discordPlugin;
