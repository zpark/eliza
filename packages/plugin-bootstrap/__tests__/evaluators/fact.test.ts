import { describe, expect, it, vi, beforeEach } from 'vitest';
import { factEvaluator, formatFacts } from '../../src/evaluators/fact';
import { composeContext, generateObjectArray, MemoryManager, ModelClass, type Memory } from '@elizaos/core';

vi.mock('@elizaos/core', () => ({
    composeContext: vi.fn(),
    generateObjectArray: vi.fn(),
    MemoryManager: vi.fn().mockImplementation((config: any) => ({
        getMemoriesByEvaluator: vi.fn().mockResolvedValue([]),
        addMemory: vi.fn().mockResolvedValue(true),
        addEmbeddingToMemory: vi.fn().mockResolvedValue({
            id: 'test-memory-id',
            content: {
                text: 'Test memory content'
            },
            userId: 'test-user-0000-0000-0000-0000-000000000000',
            agentId: 'test-agent',
            roomId: 'test-room-0000-0000-0000-0000-000000000000'
        }),
        createMemory: vi.fn().mockResolvedValue({
            id: 'test-memory-id',
            content: {
                text: 'Test memory content'
            },
            userId: 'test-user-0000-0000-0000-0000-000000000000',
            agentId: 'test-agent',
            roomId: 'test-room-0000-0000-0000-0000-000000000000'
        })
    })),
    ModelClass: {
        SMALL: 'small',
        LARGE: 'large'
    }
}));

describe('factEvaluator', () => {
    let mockRuntime;
    let mockMessage;
    let mockMemoryManager;
    
    const TEST_ROOM_ID = 'test-room-0000-0000-0000-0000-000000000000';
    const TEST_USER_ID = 'test-user-0000-0000-0000-0000-000000000000';

    beforeEach(() => {
        mockRuntime = {
            character: {
                settings: {},
                templates: {
                    factsTemplate: 'custom facts template'
                }
            },
            messageManager: {
                countMemories: vi.fn().mockResolvedValue(5)
            },
            composeState: vi.fn().mockResolvedValue({
                agentId: 'test-agent',
                roomId: TEST_ROOM_ID
            }),
            getConversationLength: vi.fn().mockReturnValue(10)
        };

        mockMessage = {
            content: {
                text: 'I live in New York and work as a software engineer.'
            },
            roomId: TEST_ROOM_ID
        };

        mockMemoryManager = {
            addEmbeddingToMemory: vi.fn().mockResolvedValue({
                id: 'test-memory-id',
                content: { text: 'Test fact' },
                userId: TEST_USER_ID,
                agentId: 'test-agent',
                roomId: TEST_ROOM_ID
            }),
            createMemory: vi.fn().mockResolvedValue(true)
        };

        vi.mocked(MemoryManager).mockImplementation(() => mockMemoryManager);

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('should validate successfully when message count is a multiple of reflection count', async () => {
            vi.mocked(mockRuntime.messageManager.countMemories).mockResolvedValue(10);
            vi.mocked(mockRuntime.getConversationLength).mockReturnValue(20);
            
            const result = await factEvaluator.validate(mockRuntime, mockMessage);
            
            expect(result).toBe(true);
            expect(mockRuntime.messageManager.countMemories).toHaveBeenCalledWith(TEST_ROOM_ID);
            expect(mockRuntime.getConversationLength).toHaveBeenCalled();
        });

        it('should not validate when message count is not a multiple of reflection count', async () => {
            vi.mocked(mockRuntime.messageManager.countMemories).mockResolvedValue(11);
            vi.mocked(mockRuntime.getConversationLength).mockReturnValue(20);
            
            const result = await factEvaluator.validate(mockRuntime, mockMessage);
            
            expect(result).toBe(false);
        });
    });

    describe('evaluator properties', () => {
        it('should have correct evaluator properties', () => {
            expect(factEvaluator.name).toBe('GET_FACTS');
            expect(factEvaluator.similes).toContain('GET_CLAIMS');
            expect(factEvaluator.similes).toContain('EXTRACT_FACTS');
            expect(factEvaluator.description).toBeDefined();
            expect(factEvaluator.description).toContain('Extract factual information');
            expect(factEvaluator.examples).toBeDefined();
            expect(Array.isArray(factEvaluator.examples)).toBe(true);
        });

        it('should have valid examples with required properties', () => {
            factEvaluator.examples.forEach(example => {
                expect(example).toHaveProperty('context');
                expect(example).toHaveProperty('messages');
                expect(example).toHaveProperty('outcome');
                expect(Array.isArray(example.messages)).toBe(true);
                expect(typeof example.context).toBe('string');
                expect(typeof example.outcome).toBe('string');
            });
        });
    });

    describe('fact extraction', () => {
        it('should handle fact extraction with custom template', async () => {
            const mockFacts = [
                {
                    claim: 'User lives in New York',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                },
                {
                    claim: 'User works as a software engineer',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(composeContext).mockReturnValue('mock-context');
            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(composeContext).toHaveBeenCalledWith({
                state: expect.any(Object),
                template: 'custom facts template'
            });
            expect(generateObjectArray).toHaveBeenCalledWith({
                runtime: mockRuntime,
                context: 'mock-context',
                modelClass: ModelClass.LARGE
            });
            expect(result).toEqual(['User lives in New York', 'User works as a software engineer']);
            expect(mockMemoryManager.addEmbeddingToMemory).toHaveBeenCalledTimes(2);
            expect(mockMemoryManager.createMemory).toHaveBeenCalledTimes(2);
        });

        it('should handle fact extraction with default template', async () => {
            // Remove custom template
            mockRuntime.character.templates = {};
            
            const mockFacts = [
                {
                    claim: 'User has a cat',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(composeContext).mockReturnValue('mock-context');
            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(composeContext).toHaveBeenCalledWith({
                state: expect.any(Object),
                template: expect.stringContaining('TASK: Extract Claims')
            });
            expect(result).toEqual(['User has a cat']);
        });

        it('should filter out already known facts', async () => {
            const mockFacts = [
                {
                    claim: 'User lives in New York',
                    type: 'fact',
                    in_bio: false,
                    already_known: true // Already known
                },
                {
                    claim: 'User works as a software engineer',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(result).toEqual(['User works as a software engineer']);
            expect(mockMemoryManager.addEmbeddingToMemory).toHaveBeenCalledTimes(1);
            expect(mockMemoryManager.createMemory).toHaveBeenCalledTimes(1);
        });

        it('should filter out facts in bio', async () => {
            const mockFacts = [
                {
                    claim: 'User lives in New York',
                    type: 'fact',
                    in_bio: true, // In bio
                    already_known: false
                },
                {
                    claim: 'User works as a software engineer',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(result).toEqual(['User works as a software engineer']);
            expect(mockMemoryManager.addEmbeddingToMemory).toHaveBeenCalledTimes(1);
        });

        it('should filter out non-fact types', async () => {
            const mockFacts = [
                {
                    claim: 'User lives in New York',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                },
                {
                    claim: 'User likes pizza',
                    type: 'opinion', // Not a fact
                    in_bio: false,
                    already_known: false
                },
                {
                    claim: 'User is currently working',
                    type: 'status', // Not a fact
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(result).toEqual(['User lives in New York']);
            expect(mockMemoryManager.addEmbeddingToMemory).toHaveBeenCalledTimes(1);
        });

        it('should filter out empty claims', async () => {
            const mockFacts = [
                {
                    claim: 'User lives in New York',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                },
                {
                    claim: '',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                },
                {
                    claim: '   ',
                    type: 'fact',
                    in_bio: false,
                    already_known: false
                }
            ];

            vi.mocked(generateObjectArray).mockResolvedValue(mockFacts);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(result).toEqual(['User lives in New York']);
            expect(mockMemoryManager.addEmbeddingToMemory).toHaveBeenCalledTimes(1);
        });

        it('should handle empty response from generateObjectArray', async () => {
            vi.mocked(generateObjectArray).mockResolvedValue([]);

            const result = await factEvaluator.handler(mockRuntime, mockMessage);

            expect(result).toEqual([]);
            expect(mockMemoryManager.addEmbeddingToMemory).not.toHaveBeenCalled();
            expect(mockMemoryManager.createMemory).not.toHaveBeenCalled();
        });
    });

    describe('formatFacts', () => {
        it('should format facts correctly', () => {
            // Using unknown to bypass type checking since we're mocking Memory objects
            const mockFacts = [
                {
                    content: { text: 'Fact 1' },
                    userId: TEST_USER_ID,
                    agentId: 'test-agent',
                    roomId: TEST_ROOM_ID
                },
                {
                    content: { text: 'Fact 2' },
                    userId: TEST_USER_ID,
                    agentId: 'test-agent',
                    roomId: TEST_ROOM_ID
                },
                {
                    content: { text: 'Fact 3' },
                    userId: TEST_USER_ID,
                    agentId: 'test-agent',
                    roomId: TEST_ROOM_ID
                }
            ] as unknown as Memory[];

            const result = formatFacts(mockFacts);
            expect(result).toBe('Fact 3\nFact 2\nFact 1');
        });

        it('should handle empty facts array', () => {
            const result = formatFacts([]);
            expect(result).toBe('');
        });
    });
});
