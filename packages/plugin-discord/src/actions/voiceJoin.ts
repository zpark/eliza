// src/actions/joinVoice
import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    type State,
    ChannelType,
    composeContext,
    createUniqueUuid,
    type HandlerCallback,
    logger,
    ModelTypes
} from "@elizaos/core";
import {
    type Channel,
    type Guild,
    type BaseGuildVoiceChannel,
    ChannelType as DiscordChannelType
} from "discord.js";
import { ServiceTypes } from "../types.ts";
import type { DiscordService } from "../index.ts";
import type { VoiceManager } from "../voice.ts";

export default {
    name: "JOIN_VOICE",
    similes: [
        "JOIN_VOICE",
        "JOIN_VC",
        "JOIN_VOICE_CHAT",
        "JOIN_VOICE_CHANNEL",
        "JOIN_MEETING",
        "JOIN_CALL",
    ],
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State
    ) => {
        if (message.content.source !== "discord") {
            // not a discord message
            return false;
        }

        const roomId = message.roomId;

        const room = await runtime.databaseAdapter.getRoom(roomId);

        if(room?.type !== ChannelType.GROUP) {
            return false;
        }

        const client = runtime.getService(ServiceTypes.DISCORD);

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        return true;
    },
    description: "Join a voice channel to participate in voice chat.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<boolean> => {
        if (!state) {
            console.error("State is not available.");
            return false;
        }

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

        console.log("Running handler on provider", room.name);

        const serverId = room.serverId;

        if (!serverId) {
            throw new Error("No server ID found 8");
        }

        const discordClient = runtime.getService(ServiceTypes.DISCORD) as DiscordService;
        const client = discordClient.client;
        const voiceManager = discordClient.voiceManager as VoiceManager;

        if (!client) {
            logger.error("Discord client not found");
            return false;
        }

        const voiceChannels = (
            client.guilds.cache.get(serverId) as Guild
        ).channels.cache.filter(
            (channel: Channel) => channel.type === DiscordChannelType.GuildVoice
        );

        const targetChannel = voiceChannels.find((channel) => {
            const name = (channel as { name: string }).name.toLowerCase();
            const messageContent = message?.content?.text;
            // remove all non-alphanumeric characters (keep spaces between words)
            const replacedName = name.replace(/[^a-z0-9 ]/g, "");

            return (
                name.includes(messageContent) ||
                messageContent.includes(name) ||
                replacedName.includes(messageContent) ||
                messageContent.includes(replacedName)
            );
        });

        if (targetChannel) {
            voiceManager.joinChannel(targetChannel as BaseGuildVoiceChannel);
            return true;
        }
            const guild = client.guilds.cache.get(serverId);
            const members = guild?.members.cache;

            // get the member who's stringTouuid(id) === message userId
            const member = members?.find((member) => createUniqueUuid(runtime, member.id) === message.userId);

            if (member?.voice?.channel) {
                voiceManager.joinChannel(member?.voice?.channel as BaseGuildVoiceChannel);
                return true;
            }

            const messageTemplate = `
The user has requested to join a voice channel.
Here is the list of channels available in the server:
{{voiceChannels}}

Here is the user's request:
{{userMessage}}

Please respond with the name of the voice channel which the bot should join. Try to infer what channel the user is talking about. If the user didn't specify a voice channel, respond with "none".
You should only respond with the name of the voice channel or none, no commentary or additional information should be included.
`;

            const guessState = {
                userMessage: message.content.text,
                voiceChannels: voiceChannels
                    .map((channel) => (channel as { name: string }).name)
                    .join("\n"),
            };

            const context = composeContext({
                template: messageTemplate,
                state: guessState as unknown as State,
            });

            const responseContent = await runtime.useModel(ModelTypes.TEXT_SMALL, {
                context,
            });

            if (responseContent && responseContent.trim().length > 0) {
                // join the voice channel
                const channelName = responseContent.toLowerCase();

                const targetChannel = voiceChannels.find((channel) => {
                    const name = (
                        channel as { name: string }
                    ).name.toLowerCase();

                    // remove all non-alphanumeric characters (keep spaces between words)
                    const replacedName = name.replace(/[^a-z0-9 ]/g, "");

                    return (
                        name.includes(channelName) ||
                        channelName.includes(name) ||
                        replacedName.includes(channelName) ||
                        channelName.includes(replacedName)
                    );
                });

                if (targetChannel) {
                    voiceManager.joinChannel(targetChannel as BaseGuildVoiceChannel);
                    return true;
                }
            }

            await callback({
                text: "I couldn't figure out which channel you wanted me to join.",
                source: "discord",
            });
            return false;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey, let's jump into the 'General' voice and chat",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sounds good",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{user2}}, can you join the vc, I want to discuss our strat",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure I'll join right now",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "hey {{user2}}, we're having a team meeting in the 'conference' voice channel, plz join us",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "OK see you there",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{user2}}, let's have a quick voice chat in the 'Lounge' channel.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "kk be there in a sec",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey {{user2}}, can you join me in the 'Music' voice channel",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "join voice chat with us {{user2}}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "coming",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "hop in vc {{user2}}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "joining now",
                    action: "JOIN_VOICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "get in vc with us {{user2}}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "im in",
                    action: "JOIN_VOICE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
