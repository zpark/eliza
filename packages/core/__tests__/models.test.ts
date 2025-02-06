import { describe, test, expect, vi, beforeEach } from "vitest";
import { AgentRuntime } from "../src/runtime";
import { ModelProviderName, ModelClass, type ModelSettings, type ImageModelSettings, type EmbeddingModelSettings } from "../src/types";

// Mock settings
vi.mock("../settings", () => {
    return {
        default: {
            PROVIDER_NAME: process.env.PROVIDER_NAME || "openai",
            PROVIDER_API_KEY: process.env.PROVIDER_API_KEY || "mock-openai-key",
            PROVIDER_ENDPOINT: process.env.PROVIDER_ENDPOINT || "https://api.openai.com/v1",
            DEFAULT_MODEL_NAME: process.env.DEFAULT_MODEL_NAME || "gpt-4o-mini",
            DEFAULT_MODEL_MAX_INPUT_TOKENS: process.env.DEFAULT_MODEL_MAX_INPUT_TOKENS || "4096",
            DEFAULT_MODEL_MAX_OUTPUT_TOKENS: process.env.DEFAULT_MODEL_MAX_OUTPUT_TOKENS || "1024",
            DEFAULT_MODEL_TEMPERATURE: process.env.DEFAULT_MODEL_TEMPERATURE || "0.7",
            DEFAULT_MODEL_STOP: process.env.DEFAULT_MODEL_STOP || "",
            DEFAULT_MODEL_FREQUENCY_PENALTY: process.env.DEFAULT_MODEL_FREQUENCY_PENALTY || "0",
            DEFAULT_MODEL_PRESENCE_PENALTY: process.env.DEFAULT_MODEL_PRESENCE_PENALTY || "0",
            DEFAULT_MODEL_REPETITION_PENALTY: process.env.DEFAULT_MODEL_REPETITION_PENALTY || "1.0",
            SMALL_MODEL_NAME: process.env.SMALL_MODEL_NAME || "gpt-4o-mini",
            MEDIUM_MODEL_NAME: process.env.MEDIUM_MODEL_NAME || "gpt-4o-mini",
            LARGE_MODEL_NAME: process.env.LARGE_MODEL_NAME || "gpt-4o-mini",
            EMBEDDING_MODEL_NAME: process.env.EMBEDDING_MODEL_NAME || "text-embedding-3-small",
            EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS || "1536",
            IMAGE_MODEL_NAME: process.env.IMAGE_MODEL_NAME || "dall-e-3",
            IMAGE_VISION_MODEL_NAME: process.env.IMAGE_VISION_MODEL_NAME || "gpt-4-vision-preview",
        },
        loadEnv: vi.fn(),
    };
});

// Mock database adapter
const mockDatabaseAdapter = {
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
    createRoom: vi.fn().mockResolvedValue("test-room-id"),
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

// Mock cache manager
const mockCacheManager = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
};

describe("Model Provider Configuration", () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        runtime = new AgentRuntime({
            token: "test-token",
            character: {
                name: "Test Character",
                username: "test",
                bio: "Test bio",
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
    });

    describe("Provider Configuration", () => {
        test("should load provider configuration from environment", () => {
            const provider = runtime.getModelProvider();
            expect(provider.endpoint).toBe(process.env.PROVIDER_ENDPOINT || "https://api.openai.com/v1");
            expect(provider.apiKey).toBe(process.env.PROVIDER_API_KEY || "mock-openai-key");
            expect(provider.provider).toBe(process.env.PROVIDER_NAME || "openai");
        });

        test("should load model mappings from environment", () => {
            const provider = runtime.getModelProvider();
            const models = provider.models;

            expect(models.default.name).toBe(process.env.DEFAULT_MODEL_NAME || "gpt-4o-mini");
            expect(models[ModelClass.SMALL]?.name).toBe(process.env.SMALL_MODEL_NAME || "gpt-4o-mini");
            expect(models[ModelClass.MEDIUM]?.name).toBe(process.env.MEDIUM_MODEL_NAME || "gpt-4o-mini");
            expect(models[ModelClass.LARGE]?.name).toBe(process.env.LARGE_MODEL_NAME || "gpt-4o-mini");
            expect(models[ModelClass.EMBEDDING]?.name).toBe(process.env.EMBEDDING_MODEL_NAME || "text-embedding-3-small");
        });

        test("should load model settings from environment", () => {
            const provider = runtime.getModelProvider();
            const defaultModel = provider.models.default as ModelSettings;

            expect(defaultModel.maxInputTokens).toBe(parseInt(process.env.DEFAULT_MODEL_MAX_INPUT_TOKENS || "4096"));
            expect(defaultModel.maxOutputTokens).toBe(parseInt(process.env.DEFAULT_MODEL_MAX_OUTPUT_TOKENS || "1024"));
            expect(defaultModel.stop).toEqual(process.env.DEFAULT_MODEL_STOP ? process.env.DEFAULT_MODEL_STOP.split(",") : []);
            expect(defaultModel.temperature).toBe(parseFloat(process.env.DEFAULT_MODEL_TEMPERATURE || "0.7"));
            expect(defaultModel.frequency_penalty).toBe(parseFloat(process.env.DEFAULT_MODEL_FREQUENCY_PENALTY || "0"));
            expect(defaultModel.presence_penalty).toBe(parseFloat(process.env.DEFAULT_MODEL_PRESENCE_PENALTY || "0"));
            expect(defaultModel.repetition_penalty).toBe(parseFloat(process.env.DEFAULT_MODEL_REPETITION_PENALTY || "1.0"));
        });

        test("should load embedding model configuration from environment", () => {
            const provider = runtime.getModelProvider();
            const embeddingModel = provider.models[ModelClass.EMBEDDING] as EmbeddingModelSettings;

            expect(embeddingModel?.name).toBe(process.env.EMBEDDING_MODEL_NAME || "text-embedding-3-small");
            expect(embeddingModel?.dimensions).toBe(parseInt(process.env.EMBEDDING_DIMENSIONS || "1536"));
        });
    });

    describe("Model Provider Validation", () => {
        test("should validate model provider name format", () => {
            expect(() => new AgentRuntime({
                token: "test-token",
                character: {
                    name: "Test Character",
                    username: "test",
                    bio: "Test bio",
                    lore: ["Test lore"],
                    modelProvider: "invalid@provider" as ModelProviderName,
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
                modelProvider: "invalid@provider" as ModelProviderName,
            })).toThrow(/Invalid model provider/);
        });
    });
});
