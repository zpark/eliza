// src/actions/leaveVoice
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
    BaseGuildVoiceChannel
} from "discord.js";

import type { DiscordService } from "../index.ts";
import type { VoiceManager } from "../voice.ts";
import { ServiceTypes } from "../types.ts";


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
    validate: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
        if (message.content.source !== "discord") {
            // not a discord message
            return false;
        }

        const client = runtime.getService(ServiceTypes.DISCORD);

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        // Check if the client is connected to any voice channel
        const isConnectedToVoice = client.client.voice.adapters.size > 0;

        return isConnectedToVoice;
    },
    description: "Leave the current voice channel.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State,
        _options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<boolean> => {
        for (const response of responses) {
            await callback(response.content);
        }

        const room = await runtime.databaseAdapter.getRoom(message.roomId);
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
        const discordClient = runtime.getService(ServiceTypes.DISCORD) as DiscordService;
        const voiceManager = discordClient.voiceManager as VoiceManager;
        const client = discordClient.client;

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        if (!voiceManager) {
            logger.error("voiceManager is not available.");
            return false;
        }

        const guild = client.guilds.cache.get(serverId);

        if (!guild) {
            console.warn("Bot is not in any voice channel.");
            return false;
        }

        const voiceChannel = guild.members.me?.voice.channel;

        if (!voiceChannel || !(voiceChannel instanceof BaseGuildVoiceChannel)) {
            console.warn("Could not retrieve the voice channel.");
            return false;
        }

        const connection = voiceManager.getVoiceConnection(guild.id);
        if (!connection) {
            console.warn("No active voice connection found for the bot.");
            return false;
        }

        voiceManager.leaveChannel(voiceChannel);

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
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Great call everyone, hopping off now",
                    actions: ["LEAVE_VOICE"],
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Agreed, I'll hop off too",
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
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
                    actions: ["LEAVE_VOICE"],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
