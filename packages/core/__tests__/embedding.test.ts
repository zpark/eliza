import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    embed,
    EmbeddingProvider,
    getEmbeddingConfig,
    getEmbeddingType,
    getEmbeddingZeroVector
} from "../src/embedding.ts";
import settings from "../src/settings.ts";
import { type IAgentRuntime, type IDatabaseAdapter, ModelClass, ModelProviderName } from "../src/types.ts";

// Mock environment-related settings
vi.mock("../settings", () => ({
    default: {
        USE_OPENAI_EMBEDDING: "false",
        USE_OLLAMA_EMBEDDING: "false",
        USE_GAIANET_EMBEDDING: "false",
    },
}));


describe("Embedding Configuration", () => {
    test("should return default config when no runtime provided", () => {
        const config = getEmbeddingConfig();
        expect(config.provider).toBe(EmbeddingProvider.OpenAI);
        expect(config.model).toBe("text-embedding-3-small");
        expect(config.dimensions).toBe(1536);
    });
}); 


// Mock fastembed module for local embeddings
vi.mock("fastembed", () => {
    class MockFlagEmbedding {
        

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

// Mock fetch for remote embedding calls
global.fetch = vi.fn();

describe("Embedding Module", () => {
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Reset settings
        vi.mocked(settings).USE_OPENAI_EMBEDDING = "false";
        
        // Prepare a mock runtime
        mockRuntime = {
            agentId: "00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
            serverUrl: "http://test-server",
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
            },
            getModelProvider: () => ({
                apiKey: "test-key",
                endpoint: "test-endpoint",
                provider: ModelProviderName.OPENAI,
                models: {
                    [ModelClass.EMBEDDING]: {
                        name: "text-embedding-3-small",
                        dimensions: 1536
                    }
                },
            }),
            getSetting: (key: string) => {
                const settings = {
                    USE_OPENAI_EMBEDDING: "false",
                    PROVIDER_ENDPOINT: "https://api.openai.com/v1",
                    PROVIDER_API_KEY: "test-key"
                };
                return settings[key as keyof typeof settings] || "";
            },
            messageManager: {
                getCachedEmbeddings: vi.fn().mockResolvedValue([])
            }
        } as unknown as IAgentRuntime;

        // Reset fetch mock with proper Response object
        const mockResponse = {
            ok: true,
            json: async () => ({
                data: [{ embedding: new Array(384).fill(0.1) }],
            }),
            headers: new Headers(),
            redirected: false,
            status: 200,
            statusText: "OK",
            type: "basic",
            url: "https://api.openai.com/v1/embeddings",
            body: null,
            bodyUsed: false,
            clone: () => ({} as Response),
            arrayBuffer: async () => new ArrayBuffer(0),
            blob: async () => new Blob(),
            formData: async () => new FormData(),
            text: async () => ""
        } as Response;

        vi.mocked(global.fetch).mockReset();
        vi.mocked(global.fetch).mockResolvedValue(mockResponse);
    });

    describe("getEmbeddingConfig", () => {
        test("should return OpenAI config by default", () => {
            const config = getEmbeddingConfig();
            expect(config.provider).toBe(EmbeddingProvider.OpenAI);
            expect(config.model).toBe("text-embedding-3-small");
            expect(config.dimensions).toBe(1536);
        });

        test("should use runtime provider when available", () => {
            const mockModelProvider = {
                provider: EmbeddingProvider.OpenAI,
                models: {
                    [ModelClass.EMBEDDING]: {
                        name: "text-embedding-3-small",
                        dimensions: 1536
                    }
                }
            };

            const runtime = {
                getModelProvider: () => mockModelProvider
            } as unknown as IAgentRuntime;

            const config = getEmbeddingConfig(runtime);
            expect(config.provider).toBe(EmbeddingProvider.OpenAI);
            expect(config.model).toBe("text-embedding-3-small");
            expect(config.dimensions).toBe(1536);
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

        test("should handle local embedding successfully", async () => {
            const result = await embed(mockRuntime, "test input");
            expect(result).toHaveLength(384);
            expect(result.every((v) => typeof v === "number")).toBe(true);
        });

        test("should handle remote embedding successfully", async () => {
            // Force remote embedding
            const runtimeWithOpenAI = {
                ...mockRuntime,
                getSetting: (key: string) => {
                    if (key === "USE_OPENAI_EMBEDDING") return "true";
                    return mockRuntime.getSetting(key);
                },
                getModelProvider: () => ({
                    ...mockRuntime.getModelProvider(),
                    provider: EmbeddingProvider.OpenAI,
                    models: {
                        [ModelClass.EMBEDDING]: {
                            name: "text-embedding-3-small",
                            dimensions: 1536
                        }
                    }
                })
            } as IAgentRuntime;
            
            const result = await embed(runtimeWithOpenAI, "test input");
            expect(result).toHaveLength(384);
            expect(vi.mocked(global.fetch)).toHaveBeenCalled();
        });

        test("should throw on remote embedding if fetch fails", async () => {
            // Force remote embedding
            const runtimeWithOpenAI = {
                ...mockRuntime,
                getSetting: (key: string) => {
                    if (key === "USE_OPENAI_EMBEDDING") return "true";
                    return mockRuntime.getSetting(key);
                },
                getModelProvider: () => ({
                    ...mockRuntime.getModelProvider(),
                    provider: EmbeddingProvider.OpenAI,
                    models: {
                        [ModelClass.EMBEDDING]: {
                            name: "text-embedding-3-small",
                            dimensions: 1536
                        }
                    }
                })
            } as IAgentRuntime;

            // Mock fetch to reject
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error("API Error"));

            await expect(embed(runtimeWithOpenAI, "test input")).rejects.toThrow("API Error");
        });

        test("should handle concurrent embedding requests", async () => {
            const promises = Array(5)
                .fill(null)
                .map(() => embed(mockRuntime, "concurrent test"));
            await expect(Promise.all(promises)).resolves.toBeDefined();
        });
    });

    // Add tests for new embedding configurations
    describe("embedding configuration", () => {
        test("should handle embedding provider configuration", async () => {
            const mockModelProvider = {
                generateText: vi.fn(),
                generateObject: vi.fn(),
                generateImage: vi.fn(),
                generateEmbedding: vi.fn(),
                provider: EmbeddingProvider.OpenAI,
                models: {
                    [ModelClass.EMBEDDING]: {
                        name: "text-embedding-3-small",
                        dimensions: 1536
                    }
                },
                getModelProvider: () => mockModelProvider
            };

            const runtime = {
                agentId: "test-agent",
                serverUrl: "http://test.com",
                databaseAdapter: {} as IDatabaseAdapter,
                token: "test-token",
                modelProvider: mockModelProvider,
                imageModelProvider: mockModelProvider,
                imageVisionModelProvider: mockModelProvider,
                embeddingModelProvider: mockModelProvider,
                getModelProvider: () => mockModelProvider,
                settings: {
                    USE_OPENAI_EMBEDDING: "true",
                    USE_OLLAMA_EMBEDDING: "true",
                    USE_GAIANET_EMBEDDING: "false",
                    OPENAI_API_KEY: "test-key",
                    OLLAMA_EMBEDDING_MODEL: "mxbai-embed-large",
                }
            } as unknown as IAgentRuntime;

            const config = getEmbeddingConfig(runtime);
            expect(config.provider).toBe(EmbeddingProvider.OpenAI);
            expect(config.model).toBe("text-embedding-3-small");
            expect(config.dimensions).toBe(1536);
        });

        test("should return default config when no runtime provided", () => {
            const config = getEmbeddingConfig();
            expect(config.provider).toBe(EmbeddingProvider.OpenAI);
            expect(config.model).toBe("text-embedding-3-small");
            expect(config.dimensions).toBe(1536);
        });
    });

    describe("embedding type detection", () => {
        test("should determine embedding type based on runtime configuration", () => {
            const mockRuntimeRemote = {
                ...mockRuntime,
                getSetting: (key: string) => key === "USE_OPENAI_EMBEDDING" ? "true" : "false"
            } as IAgentRuntime;

            expect(getEmbeddingType(mockRuntimeRemote)).toBe("remote");

            const mockRuntimeLocal = {
                ...mockRuntime,
                getSetting: (key: string) => "false"
            } as IAgentRuntime;

            expect(getEmbeddingType(mockRuntimeLocal)).toBe("local");
        });
    });
});
