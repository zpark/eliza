import { getVoiceConnection } from "@discordjs/voice";
import { type Message as DiscordMessage, ChannelType as DiscordChannelType } from "discord.js";
import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { ChannelType } from "@elizaos/core";
const voiceStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Voice doesn't get a discord message, so we need to use the channel for guild data
        const room = await runtime.getRoom(message.roomId);
        if(!room) {
            throw new Error("No room found");
        }

        if (room.type !== ChannelType.GROUP) {
            // only handle in a group scenario for now
            return false;
          }

        const serverId = room.serverId;

        if (!serverId) {
            throw new Error("No server ID found 10");
        }

        const connection = getVoiceConnection(serverId);
        const agentName = state?.agentName || "The agent";
        if (!connection) {
            return `${agentName} is not currently in a voice channel`;
        }

        const channel = (
            state?.discordMessage as DiscordMessage
        )?.guild?.channels?.cache?.get(
            connection.joinConfig.channelId as string
        );

        if (!channel || channel.type !== DiscordChannelType.GuildVoice) {
            return `${agentName} is in an invalid voice channel`;
        }

        return `${agentName} is currently in the voice channel: ${channel.name} (ID: ${channel.id})`;
    },
};

export default voiceStateProvider;
