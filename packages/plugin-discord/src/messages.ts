import {
    composeContext, type Content, generateMessageResponse, generateShouldRespond, type HandlerCallback,
    type IAgentRuntime,
    type IBrowserService, type IVideoService, logger, type Media,
    type Memory, ModelClass, ServiceType,
    type State, stringToUuid, type UUID
} from "@elizaos/core";
import {
    ChannelType,
    type Client,
    type Message as DiscordMessage,
    type TextChannel,
} from "discord.js";
import { AttachmentManager } from "./attachments";
import {
    IGNORE_RESPONSE_WORDS,
    LOSE_INTEREST_WORDS,
    MESSAGE_CONSTANTS,
    MESSAGE_LENGTH_THRESHOLDS
} from "./constants";
import {
    discordMessageHandlerTemplate,
    discordShouldRespondTemplate
} from "./templates";
import {
    canSendMessage,
    sendMessageInChunks,
} from "./utils";
import type { VoiceManager } from "./voice";

interface MessageContext {
    content: string;
    timestamp: number;
}

export type InterestChannels = {
    [key: string]: {
        currentHandler: string | undefined;
        lastMessageSent: number;
        messages: { userId: UUID; userName: string; content: Content }[];
        previousContext?: MessageContext;
        contextSimilarityThreshold?: number;
    };
};

// Type for pending message tasks
type PendingMessageTask = {
    cancel: () => void;
    promise: Promise<any>;
};

export class MessageManager {
    private client: Client;
    private runtime: IAgentRuntime;
    private attachmentManager: AttachmentManager;
    private interestChannels: InterestChannels = {};
    private discordClient: any;
    private voiceManager: VoiceManager;
    private lastChannelActivity: { [channelId: string]: number } = {};
    private autoPostInterval: NodeJS.Timeout;
    // Map to track pending message tasks by room
    private pendingMessageTasks: Map<string, PendingMessageTask> = new Map();

    constructor(discordClient: any, voiceManager: VoiceManager) {
        this.client = discordClient.client;
        this.voiceManager = voiceManager;
        this.discordClient = discordClient;
        this.runtime = discordClient.runtime;
        this.attachmentManager = new AttachmentManager(this.runtime);
    }

    private async cancelPendingTask(roomId: string) {
        const pendingTask = this.pendingMessageTasks.get(roomId);
        if (pendingTask) {
            pendingTask.cancel();
            this.pendingMessageTasks.delete(roomId);
        }
    }

    private async queueMessageTask(roomId: string, task: () => Promise<any>): Promise<any> {
        // Cancel any existing task for this room
        await this.cancelPendingTask(roomId);

        // Create a cancellable task
        let isCancelled = false;
        const cancel = () => {
            isCancelled = true;
        };

        const promise = new Promise(async (resolve, reject) => {
            try {
                const result = await task();
                if (!isCancelled) {
                    resolve(result);
                }
            } catch (error) {
                if (!isCancelled) {
                    reject(error);
                }
            } finally {
                if (!isCancelled) {
                    this.pendingMessageTasks.delete(roomId);
                }
            }
        });

        // Store the new task
        this.pendingMessageTasks.set(roomId, { cancel, promise });

        return promise;
    }

    async handleMessage(message: DiscordMessage) {
        if (this.runtime.character.settings?.discord?.allowedChannelIds &&
            !this.runtime.character.settings.discord.allowedChannelIds.includes(message.channelId)) {
            return;
        }

        this.runtime.emitEvent("DISCORD_MESSAGE_RECEIVED", { message });

        // Update last activity time for the channel
        this.lastChannelActivity[message.channelId] = Date.now();

        if (
            message.interaction ||
            message.author.id === this.client.user?.id
        ) {
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
            message.channel.type === ChannelType.DM
        ) {
            return;
        }

        const userId = message.author.id as UUID;
        const userName = message.author.username;
        const name = message.author.displayName;
        const channelId = message.channel.id;
        const hasInterest = this._checkInterest(message.channelId);
        const roomId = stringToUuid(channelId + "-" + this.runtime.agentId);

        try {
            const { processedContent, attachments } = await this.processMessageMedia(message);

            const audioAttachments = message.attachments.filter((attachment) =>
                attachment.contentType?.startsWith("audio/")
            );
            if (audioAttachments.size > 0) {
                const processedAudioAttachments = await this.attachmentManager.processAttachments(audioAttachments);
                attachments.push(...processedAudioAttachments);
            }

            const userIdUUID = stringToUuid(userId);

            await this.runtime.ensureConnection(
                userIdUUID,
                roomId,
                userName,
                name,
                "discord"
            );

            const messageId = stringToUuid(message.id + "-" + this.runtime.agentId);
            let shouldIgnore = false;
            let shouldRespond = true;

            const content: Content = {
                text: processedContent,
                attachments: attachments,
                source: "discord",
                url: message.url,
                inReplyTo: message.reference?.messageId
                    ? stringToUuid(message.reference.messageId + "-" + this.runtime.agentId)
                    : undefined,
            };

            const userMessage = {
                content,
                userId: userIdUUID,
                agentId: this.runtime.agentId,
                roomId,
            };

            const memory: Memory = {
                id: stringToUuid(message.id + "-" + this.runtime.agentId),
                ...userMessage,
                userId: userIdUUID,
                agentId: this.runtime.agentId,
                roomId,
                content,
                createdAt: message.createdTimestamp,
            };

            if (content.text) {
                await this.runtime.messageManager.addEmbeddingToMemory(memory);
                await this.runtime.messageManager.createMemory(memory);

                if (this.interestChannels[message.channelId]) {
                    this.interestChannels[message.channelId].messages.push({
                        userId: userIdUUID,
                        userName: userName,
                        content: content,
                    });

                    if (this.interestChannels[message.channelId].messages.length > MESSAGE_CONSTANTS.MAX_MESSAGES) {
                        this.interestChannels[message.channelId].messages =
                            this.interestChannels[message.channelId].messages.slice(-MESSAGE_CONSTANTS.MAX_MESSAGES);
                    }
                }
            }

            let state = await this.runtime.composeState(userMessage, {
                discordClient: this.client,
                discordMessage: message,
                agentName: this.runtime.character.name || this.client.user?.displayName,
            });

            const canSendResult = canSendMessage(message.channel);
            if (!canSendResult.canSend) {
                return logger.warn(
                    `Cannot send message to channel ${message.channel}`,
                    canSendResult
                );
            }

            if (!shouldIgnore) {
                shouldIgnore = await this._shouldIgnore(message);
            }

            if (shouldIgnore) {
                return;
            }

            const agentUserState = await this.runtime.databaseAdapter.getParticipantUserState(
                roomId,
                this.runtime.agentId
            );

            if (
                agentUserState === "MUTED" &&
                !message.mentions.has(this.client.user.id) &&
                !hasInterest
            ) {
                console.log("Ignoring muted room");
                return;
            }

            if (agentUserState === "FOLLOWED") {
                shouldRespond = true;
            } else if ((!shouldRespond && hasInterest) || (shouldRespond && !hasInterest)) {
                shouldRespond = await this._shouldRespond(message, state);
            }

            if (shouldRespond) {
                await this.queueMessageTask(roomId.toString(), async () => {
                    const context = composeContext({
                        state,
                        template:
                            this.runtime.character.templates?.discordMessageHandlerTemplate ||
                            discordMessageHandlerTemplate,
                    });

                    const stopTyping = this.simulateTyping(message);

                    try {
                        const responseContent = await generateMessageResponse({
                            runtime: this.runtime,
                            context,
                            modelClass: ModelClass.TEXT_LARGE,
                        });

                        await this.runtime.databaseAdapter.log({
                            body: { message, context, response: responseContent },
                            userId: userId,
                            roomId,
                            type: "response",
                        });

                        responseContent.text = responseContent.text?.trim();
                        responseContent.inReplyTo = stringToUuid(
                            message.id + "-" + this.runtime.agentId
                        );

                        const callback: HandlerCallback = async (content: Content, files: any[]) => {
                            try {
                                if (message.id && !content.inReplyTo) {
                                    content.inReplyTo = stringToUuid(
                                        message.id + "-" + this.runtime.agentId
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
                                        id: stringToUuid(m.id + "-" + this.runtime.agentId),
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

                        const responseMessages: Memory[] = [{
                            id: stringToUuid(messageId + "-" + this.runtime.agentId),
                            userId: this.runtime.agentId,
                            agentId: this.runtime.agentId,
                            content: responseContent,
                            roomId,
                            createdAt: Date.now(),
                        }];

                        state = await this.runtime.updateRecentMessageState(state);

                        await this.runtime.processActions(
                            memory,
                            responseMessages,
                            state,
                            callback
                        );

                        stopTyping();
                        return responseMessages;
                    } catch (error) {
                        stopTyping();
                        throw error;
                    }
                });
            }

            await this.runtime.evaluate(memory, state, shouldRespond);
        } catch (error) {
            console.error("Error handling message:", error);
            if (message.channel.type === ChannelType.GuildVoice) {
                const errorMessage = "Sorry, I had a glitch. What was that?";
                const audioStream = await this.runtime.useModel(ModelClass.TEXT_TO_SPEECH, errorMessage);
                await this.voiceManager.playAudioStream(userId, audioStream);
            } else {
                console.error("Error sending message:", error);
            }
        }
    }

    async cacheMessages(channel: TextChannel, count = 20) {
        const messages = await channel.messages.fetch({ limit: count });
        for (const [_, message] of messages) {
            await this.handleMessage(message);
        }
    }

    async processMessageMedia(message: DiscordMessage): Promise<{ processedContent: string; attachments: Media[] }> {
        let processedContent = message.content;
        let attachments: Media[] = [];

        const codeBlockRegex = /```([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(processedContent))) {
            const codeBlock = match[1];
            const lines = codeBlock.split("\n");
            const title = lines[0];
            const description = lines.slice(0, 3).join("\n");
            const attachmentId = `code-${Date.now()}-${Math.floor(Math.random() * 1000)}`.slice(-5);
            attachments.push({
                id: attachmentId,
                url: "",
                title: title || "Code Block",
                source: "Code",
                description: description,
                text: codeBlock,
            });
            processedContent = processedContent.replace(match[0], `Code Block (${attachmentId})`);
        }

        if (message.attachments.size > 0) {
            attachments = await this.attachmentManager.processAttachments(message.attachments);
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = processedContent.match(urlRegex) || [];

        for (const url of urls) {
            if (this.runtime.getService<IVideoService>(ServiceType.VIDEO)?.isVideoUrl(url)) {
                const videoService = this.runtime.getService<IVideoService>(ServiceType.VIDEO);
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
                const browserService = this.runtime.getService<IBrowserService>(ServiceType.BROWSER);
                if (!browserService) {
                    throw new Error("Browser service not found");
                }

                const { title, description: summary } = await browserService.getPageContent(url, this.runtime);

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
    
        private _checkInterest(channelId: string): boolean {
            const channelState = this.interestChannels[channelId];
            if (!channelState) return false;
    
            if (channelState.messages.length > 0) {
                const recentMessages = channelState.messages.slice(-MESSAGE_CONSTANTS.RECENT_MESSAGE_COUNT);
                const differentUsers = new Set(recentMessages.map((m) => m.userId)).size;
    
                if (differentUsers > 1 && !recentMessages.some((m) => m.userId === this.client.user?.id)) {
                    delete this.interestChannels[channelId];
                    return false;
                }
            }
    
            return true;
        }
    
        private async _shouldIgnore(message: DiscordMessage): Promise<boolean> {
            if (message.author.id === this.client.user?.id) return true;
    
            let messageContent = message.content.toLowerCase();
    
            const botMention = `<@!?${this.client.user?.id}>`;
            messageContent = messageContent.replace(
                new RegExp(botMention, "gi"),
                this.runtime.character.name.toLowerCase()
            );
    
            const botUsername = this.client.user?.username.toLowerCase();
            messageContent = messageContent.replace(
                new RegExp(`\\b${botUsername}\\b`, "g"),
                this.runtime.character.name.toLowerCase()
            );
    
            messageContent = messageContent.replace(/[^a-zA-Z0-9\s]/g, "");
    
            if (
                messageContent.length < MESSAGE_LENGTH_THRESHOLDS.LOSE_INTEREST &&
                LOSE_INTEREST_WORDS.some((word) => messageContent.includes(word))
            ) {
                delete this.interestChannels[message.channelId];
                return true;
            }
    
            if (
                messageContent.length < MESSAGE_LENGTH_THRESHOLDS.SHORT_MESSAGE &&
                !this.interestChannels[message.channelId]
            ) {
                return true;
            }
    
            const targetedPhrases = [
                this.runtime.character.name + " stop responding",
                this.runtime.character.name + " stop talking",
                this.runtime.character.name + " shut up",
                this.runtime.character.name + " stfu",
                "stop talking" + this.runtime.character.name,
                this.runtime.character.name + " stop talking",
                "shut up " + this.runtime.character.name,
                this.runtime.character.name + " shut up",
                "stfu " + this.runtime.character.name,
                this.runtime.character.name + " stfu",
                "chill" + this.runtime.character.name,
                this.runtime.character.name + " chill",
            ];
    
            if (targetedPhrases.some((phrase) => messageContent.includes(phrase))) {
                delete this.interestChannels[message.channelId];
                return true;
            }
    
            if (
                !this.interestChannels[message.channelId] &&
                messageContent.length < MESSAGE_LENGTH_THRESHOLDS.VERY_SHORT_MESSAGE
            ) {
                return true;
            }
    
            if (
                message.content.length < MESSAGE_LENGTH_THRESHOLDS.IGNORE_RESPONSE &&
                IGNORE_RESPONSE_WORDS.some((word) => message.content.toLowerCase().includes(word))
            ) {
                return true;
            }
    
            return false;
        }
    
        private async _shouldRespond(message: DiscordMessage, state: State): Promise<boolean> {
            if (message.author.id === this.client.user?.id) return false;
    
            const channelState = this.interestChannels[message.channelId];
    
            if (message.mentions.has(this.client.user?.id as string)) return true;
    
            const guild = message.guild;
            const member = guild?.members.cache.get(this.client.user?.id as string);
            const nickname = member?.nickname;
    
            if (
                message.content.toLowerCase().includes(this.client.user?.username.toLowerCase() as string) ||
                message.content.toLowerCase().includes(this.client.user?.tag.toLowerCase() as string) ||
                (nickname && message.content.toLowerCase().includes(nickname.toLowerCase()))
            ) {
                return true;
            }
    
            const shouldRespondContext = composeContext({
                state,
                template:
                    this.runtime.character.templates?.discordShouldRespondTemplate ||
                    this.runtime.character.templates?.shouldRespondTemplate ||
                    discordShouldRespondTemplate,
            });
    
            const response = await generateShouldRespond({
                runtime: this.runtime,
                context: shouldRespondContext,
                modelClass: ModelClass.TEXT_SMALL,
            });
    
            if (response.includes("RESPOND")) {
                if (channelState) {
                    channelState.previousContext = {
                        content: message.content,
                        timestamp: Date.now(),
                    };
                }
                return true;
            } else if (response.includes("IGNORE")) {
                return false;
            } else if (response.includes("STOP")) {
                delete this.interestChannels[message.channelId];
                return false;
            } else {
                console.error("Invalid response from response generateText:", response);
                return false;
            }
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
    
        private simulateTyping(message: DiscordMessage) {
            let typing = true;
    
            const typingLoop = async () => {
                while (typing) {
                    await (message.channel as TextChannel).sendTyping();
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            };
    
            typingLoop();
    
            return function stopTyping() {
                typing = false;
            };
        }
    }