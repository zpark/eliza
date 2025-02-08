import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { AgentRuntime } from "../src/runtime";
import {
    type Action,
    type IDatabaseAdapter,
    type IMemoryManager,
    type Memory,
    ModelClass,
    ServiceType,
    type UUID
} from "../src/types";
import { mockCharacter } from "./mockCharacter";

// Mock the embedding module
vi.mock("../src/embedding", () => ({
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    getRemoteEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    getLocalEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]))
}));

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
    delete: vi.fn().mockResolvedValue(undefined)
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

describe("AgentRuntime", () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        const ModelManager = {
            getProvider: () => mockModelProvider,
        };
        
        runtime = new AgentRuntime({
            character: {
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
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager,
        });
    });

    describe("memory manager service", () => {
        it("should provide access to different memory managers", () => {
            expect(runtime.messageManager).toBeDefined();
            expect(runtime.descriptionManager).toBeDefined();
            expect(runtime.loreManager).toBeDefined();
            expect(runtime.documentsManager).toBeDefined();
            expect(runtime.knowledgeManager).toBeDefined();
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
            const provider = runtime.getModelManager();
            expect(provider).toBeDefined();
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
            character: {
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
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager,
        });
    });

    describe("Model Provider Initialization", () => {
        test("should initialize with default values when no specific settings provided", () => {
            const runtime = new AgentRuntime({
                character: mockCharacter,
                databaseAdapter: mockDatabaseAdapter,
                cacheManager: mockCacheManager,
            });

            const provider = runtime.getModelManager();
            expect(provider.models.default).toBeDefined();
            expect(provider.models.default.name).toBeDefined();
        });

        test("should handle missing optional model configurations", () => {
            const provider = runtime.getModelManager();
            
            // These might be undefined but shouldn't throw errors
            expect(() => provider.models[ModelClass.IMAGE]).not.toThrow();
            expect(() => provider.models[ModelClass.IMAGE_VISION]).not.toThrow();
        });

        test("should validate model provider name format", () => {
            // Test invalid provider names
            const invalidProviders = ["invalid@provider", "123provider", "provider!", "provider space"];
            
            invalidProviders.forEach(invalidProvider => {
                expect(() => new AgentRuntime({
                    character: {
                        ...mockCharacter,
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
                    databaseAdapter: mockDatabaseAdapter,
                    cacheManager: mockCacheManager,
                })).toThrow(/Invalid model provider/);
            });

            // Test valid provider names
            const validProviders = [];
            
            validProviders.forEach(validProvider => {
                expect(() => new AgentRuntime({
                    character: {
                        ...mockCharacter,
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

describe("ModelManager", () => {
    test("should get correct model provider settings", async () => {
        const runtime = new AgentRuntime({
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
            },
        });

        const provider = runtime.getModelManager();
        expect(provider).toBeDefined();
    });
});

describe("MemoryManagerService", () => {
    test("should provide access to different memory managers", async () => {
        const runtime = new AgentRuntime({
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager
        });

        expect(runtime.messageManager).toBeDefined();
        expect(runtime.descriptionManager).toBeDefined();
        expect(runtime.loreManager).toBeDefined();
        expect(runtime.documentsManager).toBeDefined();
        expect(runtime.knowledgeManager).toBeDefined();
    });

    test("should allow registering custom memory managers", async () => {
        const runtime = new AgentRuntime({
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager
        });

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
            addEmbeddingToMemory: vi.fn()
        };

        runtime.registerMemoryManager(customManager);
        expect(runtime.getMemoryManager("custom")).toBe(customManager);
    });
});

describe("ServiceManager", () => {
    test("should handle service registration and retrieval", async () => {
        const runtime = new AgentRuntime({
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: mockCacheManager
        });

        const mockService = {
            serviceType: ServiceType.TEXT_GENERATION,
            type: ServiceType.TEXT_GENERATION,
            initialize: vi.fn().mockResolvedValue(undefined)
        };

        await runtime.registerService(mockService);
        const retrievedService = runtime.getService(ServiceType.TEXT_GENERATION);
        expect(retrievedService).toBe(mockService);
    });
});
