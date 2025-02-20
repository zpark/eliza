// src/actions/leaveVoice
import { getVoiceConnection } from "@discordjs/voice";
import {
    ChannelType,
    logger,
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import {
    ChannelType as DiscordChannelType,
    type Channel
} from "discord.js";

export default {
    name: "LEAVE_VOICE",
    similes: [
        "LEAVE_VOICE",
        "LEAVE_VC",
        "LEAVE_VOICE_CHAT",
        "LEAVE_VOICE_CHANNEL",
        "LEAVE_MEETING",
        "LEAVE_CALL",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        if (message.content.source !== "discord") {
            // not a discord message
            return false;
        }

        const client = runtime.getClient("discord").client;

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        // Check if the client is connected to any voice channel
        const isConnectedToVoice = client.voice.adapters.size > 0;

        return isConnectedToVoice;
    },
    description: "Leave the current voice channel.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<boolean> => {
        for (const response of responses) {
            await callback(response.content);
        }

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
            throw new Error("No server ID found 9");
        }

        const client = runtime.getClient("discord").client;

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        const voiceChannels = client.client.guilds.cache
            .get(serverId)
            ?.channels.cache.filter(
                (channel: Channel) => channel.type === DiscordChannelType.GuildVoice
            );

        voiceChannels?.forEach((_channel: Channel) => {
            const connection = getVoiceConnection(
                serverId
            );
            if (connection) {
                connection.destroy();
            }
        });
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey {{user2}} please leave the voice channel",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I have to go now but thanks for the chat",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "You too, talk to you later",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Great call everyone, hopping off now",
                    action: "LEAVE_VOICE",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Agreed, I'll hop off too",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey {{user2}} I need you to step away from the voice chat for a bit",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "No worries, I'll leave the voice channel",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{user2}}, I think we covered everything, you can leave the voice chat now",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sounds good, see you both later",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "leave voice {{user2}}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "ok leaving",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "plz leave the voice chat {{user2}}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "aight im out",
                    action: "LEAVE_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "yo {{user2}} gtfo the vc",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "sorry, talk to you later",
                    action: "LEAVE_VOICE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
