import { describe, test, expect, vi, beforeEach } from "vitest";
import {
    embed,
    getEmbeddingConfig,
    getEmbeddingType,
    getEmbeddingZeroVector,
} from "../src/embedding.ts";
import { type IAgentRuntime, ModelProviderName } from "../src/types.ts";
import settings from "../src/settings.ts";

// Mock environment-related settings
vi.mock("../settings", () => ({
    default: {
        USE_OPENAI_EMBEDDING: "false",
        USE_OLLAMA_EMBEDDING: "false",
        USE_GAIANET_EMBEDDING: "false",
        OPENAI_API_KEY: "mock-openai-key",
        OPENAI_API_URL: "https://api.openai.com/v1",
        GAIANET_API_KEY: "mock-gaianet-key",
        OLLAMA_EMBEDDING_MODEL: "mxbai-embed-large",
        GAIANET_EMBEDDING_MODEL: "nomic-embed",
    },
}));

// Mock fastembed module for local embeddings
vi.mock("fastembed", () => {
    class MockFlagEmbedding {
        constructor() {}

        static async init() {
            return new MockFlagEmbedding();
        }

        async queryEmbed(text: string | string[]) {
            return [new Float32Array(384).fill(0.1)];
        }
    }

    return {
        FlagEmbedding: MockFlagEmbedding,
        EmbeddingModel: {
            BGESmallENV15: "BGE-small-en-v1.5",
        },
    };
});

// Mock global fetch for remote embedding requests
const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

describe("Embedding Module", () => {
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Prepare a mock runtime
        mockRuntime = {
            agentId: "00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
            serverUrl: "http://test-server",
            databaseAdapter: {
                init: vi.fn(),
                close: vi.fn(),
                getMemories: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                searchMemories: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                getGoals: vi.fn(),
                createGoal: vi.fn(),
                updateGoal: vi.fn(),
                removeGoal: vi.fn(),
                getRoom: vi.fn(),
                createRoom: vi.fn(),
                removeRoom: vi.fn(),
                addParticipant: vi.fn(),
                removeParticipant: vi.fn(),
                getParticipantsForRoom: vi.fn(),
                getParticipantUserState: vi.fn(),
                setParticipantUserState: vi.fn(),
                createRelationship: vi.fn(),
                getRelationship: vi.fn(),
                getRelationships: vi.fn(),
                getKnowledge: vi.fn(),
                searchKnowledge: vi.fn(),
                createKnowledge: vi.fn(),
                removeKnowledge: vi.fn(),
                clearKnowledge: vi.fn(),
            },
            token: "test-token",
            modelProvider: ModelProviderName.OPENAI,
            imageModelProvider: ModelProviderName.OPENAI,
            imageVisionModelProvider: ModelProviderName.OPENAI,
            providers: [],
            actions: [],
            evaluators: [],
            plugins: [],
            character: {
                modelProvider: ModelProviderName.OPENAI,
                name: "Test Character",
                username: "test",
                bio: ["Test bio"],
                lore: ["Test lore"],
                messageExamples: [],
                postExamples: [],
                topics: [],
                adjectives: [],
                style: {
                    all: [],
                    chat: [],
                    post: []
                },
                clients: [],
                plugins: [],
            },
            getModelProvider: () => ({
                apiKey: "test-key",
                endpoint: "test-endpoint",
                provider: ModelProviderName.OPENAI,
                models: {
                    default: { name: "test-model", maxInputTokens: 4096, maxOutputTokens: 4096, stop: [], temperature: 0.7 },
                },
            }),
            getSetting: (key: string) => {
                const settings = {
                    USE_OPENAI_EMBEDDING: "false",
                    USE_OLLAMA_EMBEDDING: "false",
                    USE_GAIANET_EMBEDDING: "false",
                    OPENAI_API_KEY: "mock-openai-key",
                    OPENAI_API_URL: "https://api.openai.com/v1",
                    GAIANET_API_KEY: "mock-gaianet-key",
                    OLLAMA_EMBEDDING_MODEL: "mxbai-embed-large",
                    GAIANET_EMBEDDING_MODEL: "nomic-embed",
                };
                return settings[key as keyof typeof settings] || "";
            },
            knowledgeManager: {
                init: vi.fn(),
                close: vi.fn(),
                addKnowledge: vi.fn(),
                removeKnowledge: vi.fn(),
                searchKnowledge: vi.fn(),
                clearKnowledge: vi.fn(),
            },
            memoryManager: {
                init: vi.fn(),
                close: vi.fn(),
                addMemory: vi.fn(),
                removeMemory: vi.fn(),
                searchMemories: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                clearMemories: vi.fn(),
            },
            goalManager: {
                init: vi.fn(),
                close: vi.fn(),
                addGoal: vi.fn(),
                updateGoal: vi.fn(),
                removeGoal: vi.fn(),
                getGoals: vi.fn(),
                clearGoals: vi.fn(),
            },
            relationshipManager: {
                init: vi.fn(),
                close: vi.fn(),
                addRelationship: vi.fn(),
                getRelationship: vi.fn(),
                getRelationships: vi.fn(),
            },
            cacheManager: {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
            },
            services: new Map(),
            clients: {},
            messageManager: {
                runtime: {} as IAgentRuntime,
                tableName: "messages",
                addEmbeddingToMemory: vi.fn(),
                getMemories: vi.fn(),
                getCachedEmbeddings: vi.fn(),
                getMemoryById: vi.fn(),
                getMemoriesByRoomIds: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                removeAllMemories: vi.fn(),
                countMemories: vi.fn(),
            },
            descriptionManager: {
                runtime: {} as IAgentRuntime,
                tableName: "descriptions",
                addEmbeddingToMemory: vi.fn(),
                getMemories: vi.fn(),
                getCachedEmbeddings: vi.fn(),
                getMemoryById: vi.fn(),
                getMemoriesByRoomIds: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                removeAllMemories: vi.fn(),
                countMemories: vi.fn(),
            },
            documentsManager: {
                runtime: {} as IAgentRuntime,
                tableName: "documents",
                addEmbeddingToMemory: vi.fn(),
                getMemories: vi.fn(),
                getCachedEmbeddings: vi.fn(),
                getMemoryById: vi.fn(),
                getMemoriesByRoomIds: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                removeAllMemories: vi.fn(),
                countMemories: vi.fn(),
            },
            loreManager: {
                runtime: {} as IAgentRuntime,
                tableName: "lore",
                addEmbeddingToMemory: vi.fn(),
                getMemories: vi.fn(),
                getCachedEmbeddings: vi.fn(),
                getMemoryById: vi.fn(),
                getMemoriesByRoomIds: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                removeAllMemories: vi.fn(),
                countMemories: vi.fn(),
            },
            ragKnowledgeManager: {
                runtime: {} as IAgentRuntime,
                tableName: "rag_knowledge",
                getKnowledge: vi.fn(),
                createKnowledge: vi.fn(),
                removeKnowledge: vi.fn(),
                searchKnowledge: vi.fn(),
                clearKnowledge: vi.fn(),
                processFile: vi.fn(),
                cleanupDeletedKnowledgeFiles: vi.fn(),
                generateScopedId: vi.fn(),
            },
            initialize: vi.fn(),
            registerMemoryManager: vi.fn(),
            getMemoryManager: vi.fn(),
            getService: vi.fn(),
            registerService: vi.fn(),
            composeState: vi.fn(),
            processActions: vi.fn(),
            evaluate: vi.fn(),
            ensureParticipantExists: vi.fn(),
            ensureUserExists: vi.fn(),
            ensureConnection: vi.fn(),
            ensureParticipantInRoom: vi.fn(),
            ensureRoomExists: vi.fn(),
            updateRecentMessageState: vi.fn(),
            getConversationLength: vi.fn(),
            registerAction: vi.fn(),
        } as unknown as IAgentRuntime;

        // Reset fetch mock
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [new Array(384).fill(0.1)],
            }),
        });
    });

    describe("getEmbeddingConfig", () => {
        test("should return BGE config by default", () => {
            const config = getEmbeddingConfig();
            expect(config.dimensions).toBe(384);
            expect(config.model).toBe("BGE-small-en-v1.5");
            expect(config.provider).toBe("BGE");
        });
    });

    describe("getEmbeddingType", () => {
        test("should return 'local' by default", () => {
            const type = getEmbeddingType(mockRuntime);
            expect(type).toBe("local");
        });

        test("should return 'remote' when using OpenAI", () => {
            const runtimeWithOpenAI = {
                ...mockRuntime,
                getSetting: (key: string) => {
                    if (key === "USE_OPENAI_EMBEDDING") return "true";
                    return mockRuntime.getSetting(key);
                },
            } as IAgentRuntime;

            const type = getEmbeddingType(runtimeWithOpenAI);
            expect(type).toBe("remote");
        });
    });

    describe("getEmbeddingZeroVector", () => {
        beforeEach(() => {
            vi.mocked(settings).USE_OPENAI_EMBEDDING = "false";
            vi.mocked(settings).USE_OLLAMA_EMBEDDING = "false";
            vi.mocked(settings).USE_GAIANET_EMBEDDING = "false";
        });

        test("should return 384-length zero vector by default (BGE)", () => {
            const vector = getEmbeddingZeroVector();
            expect(vector).toHaveLength(384);
            expect(vector.every((val) => val === 0)).toBe(true);
        });

        test("should return 1536-length zero vector for OpenAI if enabled", () => {
            vi.mocked(settings).USE_OPENAI_EMBEDDING = "true";
            const vector = getEmbeddingZeroVector();
            expect(vector).toHaveLength(1536);
            expect(vector.every((val) => val === 0)).toBe(true);
        });
    });

    describe("embed function", () => {
        beforeEach(() => {
            // Mock a successful remote response with an example 384-dim embedding
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ embedding: new Array(384).fill(0.1) }],
                    }),
            });
        });

        test("should return an empty array for empty input text", async () => {
            const result = await embed(mockRuntime, "");
            expect(result).toEqual([]);
        });

        test("should return cached embedding if it already exists", async () => {
            const cachedEmbedding = new Array(384).fill(0.5);
            mockRuntime.messageManager.getCachedEmbeddings = vi
                .fn()
                .mockResolvedValue([{ embedding: cachedEmbedding }]);

            const result = await embed(mockRuntime, "test input");
            expect(result).toBe(cachedEmbedding);
        });

        test("should handle local embedding successfully (fastembed fallback)", async () => {
            // By default, it tries local first if in Node.
            // Then uses the mock fastembed response above.
            const result = await embed(mockRuntime, "test input");
            expect(result).toHaveLength(384);
            expect(result.every((v) => typeof v === "number")).toBe(true);
        });

        test("should fallback to remote if local embedding fails", async () => {
            // Force fastembed import to fail
            vi.mock("fastembed", () => {
                throw new Error("Module not found");
            });

            // Mock a valid remote response
            const mockResponse = {
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ embedding: new Array(384).fill(0.1) }],
                    }),
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            const result = await embed(mockRuntime, "test input");
            expect(result).toHaveLength(384);
            expect(mockFetch).toHaveBeenCalled();
        });

        test("should throw on remote embedding if fetch fails", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            vi.mocked(settings).USE_OPENAI_EMBEDDING = "true"; // Force remote

            await expect(embed(mockRuntime, "test input")).rejects.toThrow(
                "API Error"
            );
        });

        test("should throw on non-200 remote response", async () => {
            const errorResponse = {
                ok: false,
                status: 400,
                statusText: "Bad Request",
                text: () => Promise.resolve("Invalid input"),
            };
            mockFetch.mockResolvedValueOnce(errorResponse);
            vi.mocked(settings).USE_OPENAI_EMBEDDING = "true"; // Force remote

            await expect(embed(mockRuntime, "test input")).rejects.toThrow(
                "Embedding API Error"
            );
        });

        test("should handle concurrent embedding requests", async () => {
            const promises = Array(5)
                .fill(null)
                .map(() => embed(mockRuntime, "concurrent test"));
            await expect(Promise.all(promises)).resolves.toBeDefined();
        });
    });
});
