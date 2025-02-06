import { describe, it, expect, beforeEach, vi, test } from "vitest";
import { AgentRuntime } from "../src/runtime";
import {
    type IDatabaseAdapter,
    ModelProviderName,
    type Action,
    type Memory,
    type UUID,
    type IMemoryManager,
    type IModelProvider,
    ServiceType,
    ModelClass,
    type ModelSettings,
    type ImageModelSettings,
    type EmbeddingModelSettings,
} from "../src/types";
import { defaultCharacter } from "../src/defaultCharacter";

// Mock dependencies with minimal implementations
const mockDatabaseAdapter: IDatabaseAdapter = {
    db: {},
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getAccountById: vi.fn().mockResolvedValue(null),
    createAccount: vi.fn().mockResolvedValue(true),
    getMemories: vi.fn().mockResolvedValue([]),
    getMemoryById: vi.fn().mockResolvedValue(null),
    getMemoriesByRoomIds: vi.fn().mockResolvedValue([]),
    getMemoriesByIds: vi.fn().mockResolvedValue([]),
    getCachedEmbeddings: vi.fn().mockResolvedValue([]),
    log: vi.fn().mockResolvedValue(undefined),
    getActorDetails: vi.fn().mockResolvedValue([]),
    searchMemories: vi.fn().mockResolvedValue([]),
    updateGoalStatus: vi.fn().mockResolvedValue(undefined),
    searchMemoriesByEmbedding: vi.fn().mockResolvedValue([]),
    createMemory: vi.fn().mockResolvedValue(undefined),
    removeMemory: vi.fn().mockResolvedValue(undefined),
    removeAllMemories: vi.fn().mockResolvedValue(undefined),
    countMemories: vi.fn().mockResolvedValue(0),
    getGoals: vi.fn().mockResolvedValue([]),
    updateGoal: vi.fn().mockResolvedValue(undefined),
    createGoal: vi.fn().mockResolvedValue(undefined),
    removeGoal: vi.fn().mockResolvedValue(undefined),
    removeAllGoals: vi.fn().mockResolvedValue(undefined),
    getRoom: vi.fn().mockResolvedValue(null),
    createRoom: vi.fn().mockResolvedValue("test-room-id" as UUID),
    removeRoom: vi.fn().mockResolvedValue(undefined),
    getRoomsForParticipant: vi.fn().mockResolvedValue([]),
    getRoomsForParticipants: vi.fn().mockResolvedValue([]),
    addParticipant: vi.fn().mockResolvedValue(true),
    removeParticipant: vi.fn().mockResolvedValue(true),
    getParticipantsForAccount: vi.fn().mockResolvedValue([]),
    getParticipantsForRoom: vi.fn().mockResolvedValue([]),
    getParticipantUserState: vi.fn().mockResolvedValue(null),
    setParticipantUserState: vi.fn().mockResolvedValue(undefined),
    createRelationship: vi.fn().mockResolvedValue(true),
    getRelationship: vi.fn().mockResolvedValue(null),
    getRelationships: vi.fn().mockResolvedValue([]),
    getKnowledge: vi.fn().mockResolvedValue([]),
    searchKnowledge: vi.fn().mockResolvedValue([]),
    createKnowledge: vi.fn().mockResolvedValue(undefined),
    removeKnowledge: vi.fn().mockResolvedValue(undefined),
    clearKnowledge: vi.fn().mockResolvedValue(undefined),
};

const mockCacheManager = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
};

// Mock action creator
const createMockAction = (name: string): Action => ({
    name,
    description: `Test action ${name}`,
    similes: [`like ${name}`],
    examples: [],
    handler: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockImplementation(async () => true),
});

const mockModelSettings: ModelSettings = {
    name: "test-model",
    maxInputTokens: 4096,
    maxOutputTokens: 4096,
    stop: [],
    temperature: 0.7,
    frequency_penalty: 0,
    presence_penalty: 0,
    repetition_penalty: 1.0,
};

const mockImageSettings: ImageModelSettings = {
    name: "test-image-model",
    steps: 50,
};

const mockEmbeddingSettings: EmbeddingModelSettings = {
    name: "test-embedding-model",
    dimensions: 1536,
};

const mockModelProvider: IModelProvider = {
    apiKey: "test-key",
    endpoint: "test-endpoint",
    provider: ModelProviderName.OPENAI,
    models: {
        default: mockModelSettings,
        [ModelClass.SMALL]: mockModelSettings,
        [ModelClass.MEDIUM]: mockModelSettings,
        [ModelClass.LARGE]: mockModelSettings,
        [ModelClass.IMAGE]: mockImageSettings,
        [ModelClass.IMAGE_VISION]: mockModelSettings,
        [ModelClass.EMBEDDING]: mockEmbeddingSettings,
    },
};

// Mock embedding API
vi.mock("../src/embedding", () => ({
    getRemoteEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    getLocalEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
}));

describe("AgentRuntime", () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        const modelProviderManager = {
            getProvider: () => mockModelProvider,
        };
        
        runtime = new AgentRuntime({
            token: "test-token",
            character: {
                name: "Test Character",
                username: "test",
                bio: ["Test bio"],
                lore: ["Test lore"],
                modelProvider: ModelProviderName.OPENAI,
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
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager,
            modelProvider: ModelProviderName.OPENAI,
        });

        // Mock the getModelProvider method
        runtime.getModelProvider = vi.fn().mockReturnValue(mockModelProvider);
    });

    describe("memory manager service", () => {
        it("should provide access to different memory managers", () => {
            expect(runtime.messageManager).toBeDefined();
            expect(runtime.descriptionManager).toBeDefined();
            expect(runtime.loreManager).toBeDefined();
            expect(runtime.documentsManager).toBeDefined();
            expect(runtime.knowledgeManager).toBeDefined();
            expect(runtime.ragKnowledgeManager).toBeDefined();
        });

        it("should allow registering custom memory managers", () => {
            const customManager: IMemoryManager = {
                runtime: runtime,
                tableName: "custom",
                getMemories: vi.fn(),
                getCachedEmbeddings: vi.fn(),
                getMemoryById: vi.fn(),
                getMemoriesByRoomIds: vi.fn(),
                searchMemoriesByEmbedding: vi.fn(),
                createMemory: vi.fn(),
                removeMemory: vi.fn(),
                removeAllMemories: vi.fn(),
                countMemories: vi.fn(),
                addEmbeddingToMemory: vi.fn(),
            };
            runtime.registerMemoryManager(customManager);
            expect(runtime.getMemoryManager("custom")).toBe(customManager);
        });
    });

    describe("service management", () => {
        it("should allow registering and retrieving services", async () => {
            const mockService = {
                serviceType: ServiceType.TEXT_GENERATION,
                type: ServiceType.TEXT_GENERATION,
                initialize: vi.fn().mockResolvedValue(undefined),
            };

            await runtime.registerService(mockService);
            const retrievedService = runtime.getService(ServiceType.TEXT_GENERATION);
            expect(retrievedService).toBe(mockService);
        });
    });

    describe("model provider management", () => {
        it("should provide access to the configured model provider", () => {
            const provider = runtime.getModelProvider();
            expect(provider).toBeDefined();
            expect(provider.apiKey).toBeDefined();
            expect(provider.endpoint).toBeDefined();
            expect(provider.provider).toBeDefined();
            expect(provider.models).toBeDefined();
        });
    });

    describe("state management", () => {
        it("should compose state with additional keys", async () => {
            const message: Memory = {
                id: "123e4567-e89b-12d3-a456-426614174003",
                userId: "123e4567-e89b-12d3-a456-426614174004",
                agentId: "123e4567-e89b-12d3-a456-426614174005",
                roomId: "123e4567-e89b-12d3-a456-426614174003",
                content: { type: "text", text: "test message" },
            };

            const additionalKeys = {
                customKey: "customValue"
            };

            const state = await runtime.composeState(message, additionalKeys);
            expect(state).toHaveProperty("customKey", "customValue");
            expect(state).toHaveProperty("roomId");
            expect(state).toHaveProperty("actors");
            expect(state).toHaveProperty("recentMessages");
        });
    });

    describe("action management", () => {
        it("should register an action", () => {
            const action = createMockAction("testAction");
            runtime.registerAction(action);
            expect(runtime.actions).toContain(action);
        });

        it("should allow registering multiple actions", () => {
            const action1 = createMockAction("testAction1");
            const action2 = createMockAction("testAction2");
            runtime.registerAction(action1);
            runtime.registerAction(action2);
            expect(runtime.actions).toContain(action1);
            expect(runtime.actions).toContain(action2);
        });
    });
});

describe("Model Provider Configuration", () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        runtime = new AgentRuntime({
            token: "test-token",
            character: {
                name: "Test Character",
                username: "test",
                bio: ["Test bio"],
                lore: ["Test lore"],
                modelProvider: ModelProviderName.OPENAI,
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
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager,
            modelProvider: ModelProviderName.OPENAI,
        });

        // Mock the getModelProvider method
        runtime.getModelProvider = vi.fn().mockReturnValue({
            apiKey: "test-key",
            endpoint: "test-endpoint",
            provider: ModelProviderName.OPENAI,
            models: {
                default: {
                    name: "test-model",
                    maxInputTokens: 4096,
                    maxOutputTokens: 4096,
                    stop: [] as string[],
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1.0,
                },
                [ModelClass.SMALL]: {
                    name: "test-model-small",
                    maxInputTokens: 4096,
                    maxOutputTokens: 4096,
                    stop: [] as string[],
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1.0,
                },
                [ModelClass.MEDIUM]: {
                    name: "test-model-medium",
                    maxInputTokens: 4096,
                    maxOutputTokens: 4096,
                    stop: [] as string[],
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1.0,
                },
                [ModelClass.LARGE]: {
                    name: "test-model-large",
                    maxInputTokens: 4096,
                    maxOutputTokens: 4096,
                    stop: [] as string[],
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1.0,
                },
                [ModelClass.EMBEDDING]: {
                    name: "test-embedding-model",
                    dimensions: 1536,
                },
                [ModelClass.IMAGE]: {
                    name: "test-image-model",
                    steps: 50,
                },
                [ModelClass.IMAGE_VISION]: {
                    name: "test-vision-model",
                    maxInputTokens: 4096,
                    maxOutputTokens: 4096,
                    stop: [] as string[],
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1.0,
                },
            },
        });
    });

    describe("Model Provider Settings", () => {
        test("should have basic provider configuration", () => {
            const provider = runtime.getModelProvider();
            expect(provider.endpoint).toBeDefined();
            expect(provider.apiKey).toBeDefined();
            expect(provider.provider).toBeDefined();
        });

        test("should have model class mappings", () => {
            const provider = runtime.getModelProvider();
            const models = provider.models;

            expect(models.default).toBeDefined();
            expect(models[ModelClass.SMALL]).toBeDefined();
            expect(models[ModelClass.MEDIUM]).toBeDefined();
            expect(models[ModelClass.LARGE]).toBeDefined();
            expect(models[ModelClass.EMBEDDING]).toBeDefined();
        });

        test("should have correct model settings structure", () => {
            const provider = runtime.getModelProvider();
            const defaultModel = provider.models.default as ModelSettings;

            expect(defaultModel.maxInputTokens).toBeGreaterThan(0);
            expect(defaultModel.maxOutputTokens).toBeGreaterThan(0);
            expect(Array.isArray(defaultModel.stop)).toBe(true);
            expect(typeof defaultModel.temperature).toBe('number');
            expect(typeof defaultModel.frequency_penalty).toBe('number');
            expect(typeof defaultModel.presence_penalty).toBe('number');
            expect(typeof defaultModel.repetition_penalty).toBe('number');
        });

        test("should have correct embedding model structure", () => {
            const provider = runtime.getModelProvider();
            const embeddingModel = provider.models[ModelClass.EMBEDDING] as EmbeddingModelSettings;

            expect(embeddingModel.name).toBeDefined();
            expect(typeof embeddingModel.dimensions).toBe('number');
            expect(embeddingModel.dimensions).toBeGreaterThan(0);
        });

        test("should handle optional image model configuration", () => {
            const provider = runtime.getModelProvider();
            const imageModel = provider.models[ModelClass.IMAGE] as ImageModelSettings;

            if (imageModel) {
                expect(imageModel.name).toBeDefined();
                expect(typeof imageModel.steps).toBe('number');
            }
        });
    });

    describe("Model Provider Initialization", () => {
        test("should initialize with default values when no specific settings provided", () => {
            const runtime = new AgentRuntime({
                token: "test-token",
                character: defaultCharacter,
                databaseAdapter: mockDatabaseAdapter,
                cacheManager: mockCacheManager,
                modelProvider: ModelProviderName.OPENAI,
            });

            const provider = runtime.getModelProvider();
            expect(provider.models.default).toBeDefined();
            expect(provider.models.default.name).toBeDefined();
        });

        test("should handle missing optional model configurations", () => {
            const provider = runtime.getModelProvider();
            
            // These might be undefined but shouldn't throw errors
            expect(() => provider.models[ModelClass.IMAGE]).not.toThrow();
            expect(() => provider.models[ModelClass.IMAGE_VISION]).not.toThrow();
        });

        test("should validate model provider name format", () => {
            // Test invalid provider names
            const invalidProviders = ["invalid@provider", "123provider", "provider!", "provider space"];
            
            invalidProviders.forEach(invalidProvider => {
                expect(() => new AgentRuntime({
                    token: "test-token",
                    character: {
                        ...defaultCharacter,
                        modelProvider: invalidProvider,
                        bio: ["Test bio"], // Ensure bio is an array
                        lore: ["Test lore"], // Ensure lore is an array
                        messageExamples: [], // Required by Character type
                        postExamples: [], // Required by Character type
                        topics: [], // Required by Character type
                        adjectives: [], // Required by Character type
                        style: { // Required by Character type
                            all: [],
                            chat: [],
                            post: []
                        }
                    },
                    modelProvider: invalidProvider as ModelProviderName,
                    databaseAdapter: mockDatabaseAdapter,
                    cacheManager: mockCacheManager,
                })).toThrow(/Invalid model provider/);
            });

            // Test valid provider names
            const validProviders = [ModelProviderName.OPENAI, ModelProviderName.ANTHROPIC, ModelProviderName.GOOGLE];
            
            validProviders.forEach(validProvider => {
                expect(() => new AgentRuntime({
                    token: "test-token",
                    character: {
                        ...defaultCharacter,
                        modelProvider: validProvider,
                        bio: ["Test bio"], // Ensure bio is an array
                        lore: ["Test lore"], // Ensure lore is an array
                        messageExamples: [], // Required by Character type
                        postExamples: [], // Required by Character type
                        topics: [], // Required by Character type
                        adjectives: [], // Required by Character type
                        style: { // Required by Character type
                            all: [],
                            chat: [],
                            post: []
                        }
                    },
                    modelProvider: validProvider,
                    databaseAdapter: mockDatabaseAdapter,
                    cacheManager: mockCacheManager,
                })).not.toThrow();
            });
        });
    });
});
