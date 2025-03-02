import { ChannelType } from "@elizaos/core";
import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import type {
    TextChannel
} from "discord.js";

const channelStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const room = await runtime.databaseAdapter.getRoom(message.roomId);
        if(!room) {
            throw new Error("No room found");
        }

        // if message source is not discord, return
        if(message.content.source !== "discord") {
            return false;
        }

        const agentName = state?.agentName || "The agent";
        const senderName = state?.senderName || "someone";

        if (room.type === ChannelType.DM) {
            return (
                `${agentName} is currently in a direct message conversation with ${senderName}. ${agentName} should engage in conversation, should respond to messages that are addressed to them and only ignore messages that seem to not require a response.`
            );
        }

        const serverId = room.serverId;

        if (!serverId) {
            console.error("No server ID found");
            // only handle in a group scenario for now
            return false;
        }

        const channelId = room.channelId;

        const discordClient = runtime.getClient("discord");
        if(!discordClient) {
            console.warn("No discord client found");
            return false;
        }

        const guild = discordClient.client.guilds.cache.get(serverId);

        const serverName = guild.name;

        let response =
            `${agentName} is currently having a conversation in the channel \`@${channelId} in the server \`${serverName}\` (@${serverId})`;

        response += `\n${agentName} is in a room with other users and should be self-conscious and only participate when directly addressed or when the conversation is relevant to them.`;
        return response;
    },
};

export default channelStateProvider;
