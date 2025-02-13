import { logger, type TestSuite, type IAgentRuntime } from "@elizaos/core";
import { DiscordClient } from "./index.ts";
import { DiscordConfig, validateDiscordConfig } from "./environment";
import { sendMessageInChunks } from "./utils.ts";
import { ChannelType, Events, TextChannel } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";

export class DiscordTestSuite implements TestSuite {
  name = "discord";
  private discordClient: DiscordClient | null = null;
  tests: { name: string; fn: (runtime: IAgentRuntime) => Promise<void> }[];

  constructor() {
    this.tests = [
      {
        name: "test creating discord client",
        fn: this.testCreatingDiscordClient.bind(this),
      },
      {
        name: "test joining voice channel",
        fn: this.testJoiningVoiceChannel.bind(this),
      },
      {
        name: "test sending message",
        fn: this.testSendingTextMessage.bind(this),
      },
    ];
  }

  async testCreatingDiscordClient(runtime: IAgentRuntime) {
    try {
      if (!this.discordClient) {
        const discordConfig: DiscordConfig = await validateDiscordConfig(
          runtime
        );
        this.discordClient = new DiscordClient(runtime, discordConfig);
        await new Promise((resolve, reject) => {
          this.discordClient.client.once(Events.ClientReady, resolve);
          this.discordClient.client.once(Events.Error, reject);
        });
      } else {
        logger.info("Reusing existing DiscordClient instance.");
      }
      logger.success("DiscordClient successfully initialized.");
    } catch (error) {
      throw new Error("Error in test creating Discord client:", error);
    }
  }

  async testJoiningVoiceChannel(runtime: IAgentRuntime) {
    try {
      let voiceChannel = null;
      let channelId = process.env.DISCORD_VOICE_CHANNEL_ID || null;

      if (!channelId) {
        const guilds = await this.discordClient.client.guilds.fetch();
        for (const [, guild] of guilds) {
          const fullGuild = await guild.fetch();
          const voiceChannels = fullGuild.channels.cache
            .filter((c) => c.type === ChannelType.GuildVoice)
            .values();
          voiceChannel = voiceChannels.next().value;
          if (voiceChannel) break;
        }

        if (!voiceChannel) {
          logger.warn("No suitable voice channel found to join.");
          return;
        }
      } else {
        voiceChannel = await this.discordClient.client.channels.fetch(
          channelId
        );
      }

      if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
        logger.error("Invalid voice channel.");
        return;
      }

      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
        selfDeaf: false,
        selfMute: false,
        group: this.discordClient.client.user.id,
      });

      logger.success(`Joined voice channel: ${voiceChannel.id}`);
    } catch (error) {
      console.error("Error joining voice channel:", error);
    }
  }

  async testSendingTextMessage(runtime: IAgentRuntime) {
    try {
      let channel: TextChannel | null = null;
      let channelId = process.env.DISCORD_VOICE_CHANNEL_ID || null;

      if (!channelId) {
        const guilds = await this.discordClient.client.guilds.fetch();
        for (const [, guild] of guilds) {
          const fullGuild = await guild.fetch();
          const textChannels = fullGuild.channels.cache
            .filter((c) => c.type === ChannelType.GuildText)
            .values();
          channel = textChannels.next().value as TextChannel;
          if (channel) break; // Stop if we found a valid channel
        }

        if (!channel) {
          logger.warn("No suitable text channel found to send the message.");
          return;
        }
      } else {
        const fetchedChannel = await this.discordClient.client.channels.fetch(
          channelId
        );
        if (fetchedChannel && fetchedChannel.isTextBased()) {
          channel = fetchedChannel as TextChannel;
        } else {
          logger.warn(
            `Provided channel ID (${channelId}) is invalid or not a text channel.`
          );
          return;
        }
      }

      if (!channel) {
        logger.warn(
          "Failed to determine a valid channel for sending the message."
        );
        return;
      }

      await this.sendMessageToChannel(channel, "Testing sending message");
    } catch (error) {
      logger.error("Error in sending text message:", error);
    }
  }

  async sendMessageToChannel(channel: TextChannel, messageContent: string) {
    try {
      if (!channel || !channel.isTextBased()) {
        console.error("Channel is not a text-based channel or does not exist.");
        return;
      }

      await sendMessageInChunks(
        channel as TextChannel,
        messageContent,
        null,
        null
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
}
