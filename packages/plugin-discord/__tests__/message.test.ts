import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageManager } from "../src/messages.ts";
import { ChannelType, Client } from 'discord.js';
import { type IAgentRuntime } from '@elizaos/core';
import type { VoiceManager } from '../src/voice';


vi.mock('@elizaos/core', () => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    stringToUuid: (str: string) => str,
    messageCompletionFooter: '# INSTRUCTIONS: Choose the best response for the agent.',
    shouldRespondFooter: '# INSTRUCTIONS: Choose if the agent should respond.',
    generateMessageResponse: vi.fn(),
    generateShouldRespond: vi.fn().mockResolvedValue("IGNORE"), // Prevent API calls by always returning "IGNORE"
    composeContext: vi.fn(),
    ModelClass: {
        TEXT_SMALL: 'TEXT_SMALL'
    }
}));

describe('Discord MessageManager', () => {
    let mockRuntime: IAgentRuntime;
    let mockClient: Client;
    let mockDiscordClient: { client: Client; runtime: IAgentRuntime };
    let mockVoiceManager: VoiceManager;
    let mockMessage: any;
    let messageManager: MessageManager;

    beforeEach(() => {
        mockRuntime = {
            character: {
                name: 'TestBot',
                templates: {},
                clientConfig: {
                    discord: {
                        allowedChannelIds: ['mock-channal-id'],
                        shouldIgnoreBotMessages: true,
                        shouldIgnoreDirectMessages: true
                    }
                }
            },
            evaluate: vi.fn(),
            composeState: vi.fn(),
            ensureConnection: vi.fn(),
            ensureUserExists: vi.fn(),
            messageManager: {
                createMemory: vi.fn(),
                addEmbeddingToMemory: vi.fn()
            },
            databaseAdapter: {
                getParticipantUserState: vi.fn().mockResolvedValue('ACTIVE'),
                log: vi.fn()
            },
            processActions: vi.fn()
        } as unknown as IAgentRuntime;

        mockClient = new Client({ intents: [] });
        mockClient.user = {
            id: 'mock-bot-id',
            username: 'MockBot',
            tag: 'MockBot#0001',
            displayName: 'MockBotDisplay',
        } as any;
    
        mockDiscordClient = {
            client: mockClient,
            runtime: mockRuntime
        };

        mockVoiceManager = {
            playAudioStream: vi.fn()
        } as unknown as VoiceManager;

        messageManager = new MessageManager(mockDiscordClient, mockVoiceManager);

        const guild = {
            members: {
                cache: {
                    get: vi.fn().mockReturnValue({
                        nickname: 'MockBotNickname',
                        permissions: {
                            has: vi.fn().mockReturnValue(true), // Bot has permissions
                        }
                    })
                }
            }
        }
        mockMessage = {
            content: 'Hello, MockBot!',
            author: {
                id: 'mock-user-id',
                username: 'MockUser',
                bot: false
            },
            guild,
            channel: {
                id: 'mock-channal-id',
                type: ChannelType.GuildText,
                send: vi.fn(),
                guild,
                client: {
                    user: mockClient.user
                },
                permissionsFor: vi.fn().mockReturnValue({
                    has: vi.fn().mockReturnValue(true)
                })
            },
            id: 'mock-message-id',
            createdTimestamp: Date.now(),
            mentions: {
                has: vi.fn().mockReturnValue(false)
            },
            reference: null,
            attachments: []
        };
    });

    it('should initialize MessageManager', () => {
        expect(messageManager).toBeDefined();
    });

    it('should process user messages', async () => {
        // Prevent further message processing after response check
        const proto = Object.getPrototypeOf(messageManager);
        vi.spyOn(proto, '_shouldRespond').mockReturnValueOnce(false); 

        await messageManager.handleMessage(mockMessage);
        expect(mockRuntime.ensureConnection).toHaveBeenCalled();
        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
        mockMessage.author.bot = true;
        await messageManager.handleMessage(mockMessage);
        expect(mockRuntime.ensureConnection).not.toHaveBeenCalled();
    });

    it('should ignore messages from restricted channels', async () => {
        mockMessage.channel.id = 'undefined-channel-id';
        await messageManager.handleMessage(mockMessage);
        expect(mockRuntime.ensureConnection).not.toHaveBeenCalled();
    });

    it.each([
        ["Hey MockBot, are you there?", "username"],
        ["MockBot#0001, respond please.", "tag"],
        ["MockBotNickname, can you help?", "nickname"]
    ])('should respond if the bot %s is included in the message', async (content) => {
        mockMessage.content = content;
    
        const result = await messageManager["_shouldRespond"](mockMessage, {});
        expect(result).toBe(true);
    });
});
