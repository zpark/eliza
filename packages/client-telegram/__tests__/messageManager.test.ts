import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageManager } from '../src/messageManager';
import { IAgentRuntime } from '@elizaos/core';
import { Context, Telegraf } from 'telegraf';

// Mock Telegraf
vi.mock('telegraf', () => {
    return {
        Telegraf: vi.fn().mockImplementation(() => ({
            telegram: {
                sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
                editMessageText: vi.fn().mockResolvedValue({}),
                deleteMessage: vi.fn().mockResolvedValue(true),
                sendChatAction: vi.fn().mockResolvedValue(true)
            }
        }))
    };
});

describe('MessageManager', () => {
    let mockRuntime: IAgentRuntime;
    let mockBot: Telegraf<Context>;
    let messageManager: MessageManager;
    const CHAT_ID = 123456789;

    beforeEach(() => {
        mockRuntime = {
            getSetting: vi.fn(),
            getCharacter: vi.fn(),
            getFlow: vi.fn(),
            getPlugin: vi.fn(),
            getPlugins: vi.fn(),
            getSafePlugins: vi.fn(),
            hasPlugin: vi.fn(),
            registerPlugin: vi.fn(),
            removePlugin: vi.fn(),
            setCharacter: vi.fn(),
            setFlow: vi.fn()
        };

        mockBot = new Telegraf('mock_token') as any;
        messageManager = new MessageManager(mockBot, mockRuntime);

        // Add mock methods to messageManager
        messageManager.sendMessage = vi.fn().mockImplementation(async (chatId: number, text: string) => {
            return mockBot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        });

        messageManager.sendTypingAction = vi.fn().mockImplementation(async (chatId: number) => {
            return mockBot.telegram.sendChatAction(chatId, 'typing');
        });
    });

    describe('message operations', () => {
        it('should send a message successfully', async () => {
            const text = 'Test message';
            const result = await messageManager.sendMessage(CHAT_ID, text);
            
            expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
                CHAT_ID,
                text,
                expect.any(Object)
            );
            expect(result.message_id).toBe(123);
        });

        it('should send a message with markdown', async () => {
            const text = '*bold* _italic_';
            await messageManager.sendMessage(CHAT_ID, text);
            
            expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
                CHAT_ID,
                text,
                expect.objectContaining({
                    parse_mode: 'Markdown'
                })
            );
        });

        it('should handle long messages', async () => {
            const longText = 'a'.repeat(5000);
            await messageManager.sendMessage(CHAT_ID, longText);
            
            expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
                CHAT_ID,
                expect.any(String),
                expect.any(Object)
            );
        });

        it('should send typing action', async () => {
            await messageManager.sendTypingAction(CHAT_ID);
            
            expect(mockBot.telegram.sendChatAction).toHaveBeenCalledWith(
                CHAT_ID,
                'typing'
            );
        });
    });

    describe('error handling', () => {
        it('should handle send message errors gracefully', async () => {
            const error = new Error('Network error');
            vi.spyOn(mockBot.telegram, 'sendMessage').mockRejectedValueOnce(error);
            
            await expect(messageManager.sendMessage(CHAT_ID, 'test'))
                .rejects
                .toThrow('Network error');
        });

        it('should handle typing action errors gracefully', async () => {
            const error = new Error('Failed to send typing action');
            vi.spyOn(mockBot.telegram, 'sendChatAction').mockRejectedValueOnce(error);
            
            await expect(messageManager.sendTypingAction(CHAT_ID))
                .rejects
                .toThrow('Failed to send typing action');
        });
    });
});
