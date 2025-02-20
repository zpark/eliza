import { MemoryManager } from "../src/memory";
import { CacheManager, MemoryCacheAdapter } from "../src/cache";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IAgentRuntime, Memory, UUID, ModelClass, KnowledgeMetadata } from "../src/types";

describe("MemoryManager", () => {
    const TEST_UUID_1 = "123e4567-e89b-12d3-a456-426614174000" as UUID;
    const TEST_UUID_2 = "987fcdeb-51e4-3af2-b890-312345678901" as UUID;
    const AGENT_UUID = "abcdef12-3456-7890-abcd-ef1234567890" as UUID;
    const ROOM_UUID = "11111111-2222-3333-4444-555555555555" as UUID;

    let memoryManager: MemoryManager;
    let mockDatabaseAdapter: any;
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        mockDatabaseAdapter = {
            getMemories: vi.fn(),
            createMemory: vi.fn(),
            removeMemory: vi.fn(),
            removeAllMemories: vi.fn(),
            countMemories: vi.fn(),
            getCachedEmbeddings: vi.fn(),
            searchMemories: vi.fn(),
            getMemoriesByRoomIds: vi.fn(),
            getMemoryById: vi.fn(),
        };

        mockRuntime = {
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: new CacheManager(new MemoryCacheAdapter()),
            agentId: AGENT_UUID,
            useModel: vi.fn().mockResolvedValue([]),
        } as unknown as IAgentRuntime;

        memoryManager = new MemoryManager({
            tableName: "test",
            runtime: mockRuntime,
        });
    });

    describe("addEmbeddingToMemory", () => {
        it("should preserve existing embedding if present", async () => {
            const existingEmbedding = [0.1, 0.2, 0.3];
            const memory: Memory = {
                id: "test-id" as UUID,
                userId: "user-id" as UUID,
                agentId: "agent-id" as UUID,
                roomId: "room-id" as UUID,
                content: { text: "test content" },
                embedding: existingEmbedding,
            };

            const result = await memoryManager.addEmbeddingToMemory(memory);
            expect(result.embedding).toBe(existingEmbedding);
        });

        it("should throw error for empty content", async () => {
            const memory: Memory = {
                id: "test-id" as UUID,
                userId: "user-id" as UUID,
                agentId: "agent-id" as UUID,
                roomId: "room-id" as UUID,
                content: { text: "" },
            };

            await expect(
                memoryManager.addEmbeddingToMemory(memory)
            ).rejects.toThrow(
                "Cannot generate embedding: Memory content is empty"
            );
        });
    });

    describe("getMemories", () => {
        it("should handle pagination parameters", async () => {
            const roomId = "test-room" as UUID;
            const start = 0;
            const end = 5;

            await memoryManager.getMemories({ 
                roomId, 
                start, 
                end,
                count: 10,
                unique: true,
                agentId: AGENT_UUID
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith({
                roomId,
                count: 10,
                unique: true,
                tableName: "test",
                agentId: AGENT_UUID,
                start,
                end,
            });
        });

        it("should get memories with agentId", async () => {
            await memoryManager.getMemories({
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: AGENT_UUID,
                    tableName: "test",
                })
            );
        });

        it("should get memories without agentId", async () => {
            await memoryManager.getMemories({
                roomId: ROOM_UUID,
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: undefined,
                    tableName: "test",
                })
            );
        });
    });

    describe("searchMemories", () => {
        const testEmbedding = [1, 2, 3];

        it("should search memories with agentId", async () => {
            await memoryManager.searchMemories({
                embedding: testEmbedding,
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.searchMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: AGENT_UUID,
                    embedding: testEmbedding,
                })
            );
        });

        it("should search memories without agentId", async () => {
            await memoryManager.searchMemories({
                embedding: testEmbedding,
                roomId: ROOM_UUID,
            });

            expect(mockDatabaseAdapter.searchMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: undefined,
                    embedding: testEmbedding,
                })
            );
        });
    });

    describe("getMemoriesByRoomIds", () => {
        it("should get memories by room ids with agentId", async () => {
            await memoryManager.getMemoriesByRoomIds({
                roomIds: [TEST_UUID_1, TEST_UUID_2],
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.getMemoriesByRoomIds).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: [TEST_UUID_1, TEST_UUID_2],
                    agentId: AGENT_UUID,
                })
            );
        });

        it("should get memories by room ids without agentId", async () => {
            await memoryManager.getMemoriesByRoomIds({
                roomIds: [TEST_UUID_1, TEST_UUID_2],
            });

            expect(mockDatabaseAdapter.getMemoriesByRoomIds).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: [TEST_UUID_1, TEST_UUID_2],
                    agentId: undefined,
                })
            );
        });
    });

    describe("Metadata Handling", () => {
        it("should add default metadata for knowledge table", async () => {
            const manager = new MemoryManager({
                tableName: "knowledge",
                runtime: mockRuntime,
            });

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                content: { text: "test" },
            };

            await manager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: {
                        source: "knowledge",
                        scope: "private",
                        timestamp: expect.any(Number),
                    },
                }),
                "knowledge",
                false
            );
        });

        it("should validate metadata fields", async () => {
            const invalidMetadata: KnowledgeMetadata = {
                scope: "invalid" as any,
            };

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                content: { text: "test" },
                metadata: invalidMetadata,
            };

            await expect(memoryManager.createMemory(memory)).rejects.toThrow(
                'Metadata scope must be "shared", "private", or "room"'
            );
        });

        it("should set default scope based on agentId", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
                content: { text: "test" },
                metadata: {},
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        scope: "private",
                    }),
                }),
                "test",
                false
            );
        });

        it("should preserve existing metadata values", async () => {
            const existingMetadata: KnowledgeMetadata = {
                source: "user",
                scope: "shared",
                tags: ["important"],
                timestamp: 123456789,
            };

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                content: { text: "test" },
                metadata: existingMetadata,
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: existingMetadata,
                }),
                "test",
                false
            );
        });
    });
});
