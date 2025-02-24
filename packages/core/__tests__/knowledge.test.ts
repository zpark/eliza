import { describe, expect, it, mock, beforeEach, type Mock } from "bun:test";
import knowledge from "../src/knowledge";
import type { AgentRuntime } from "../src/runtime";
import type { Memory, UUID, KnowledgeItem, IMemoryManager } from "../src/types";

// Define test UUIDs
const TEST_UUID_1 = "123e4567-e89b-12d3-a456-426614174000" as UUID;
const TEST_UUID_2 = "987fcdeb-51e4-3af2-b890-312345678901" as UUID;

// Mock modules
const mockSplitChunks = mock(async (text: string) => [text]);
const mockStringToUuid = mock((str: string) => str);

// Mock the imports with correct paths
mock.module("../src/parsing.ts", () => ({
    splitChunks: mockSplitChunks,
}));

mock.module("../src/uuid.ts", () => ({
    stringToUuid: mockStringToUuid,
}));

// Define the mock function types using interfaces
type SearchMemoriesFn = IMemoryManager['searchMemories'];
type GetMemoryByIdFn = IMemoryManager['getMemoryById'];
type CreateMemoryFn = IMemoryManager['createMemory'];

describe("Knowledge Module", () => {
    let mockRuntime: AgentRuntime;

    beforeEach(() => {
        // Create properly typed mocks with separate instances
        const searchMemoriesMock = mock(() => Promise.resolve([])) as Mock<SearchMemoriesFn>;
        const getMemoryByIdMock = mock(() => Promise.resolve(null)) as Mock<GetMemoryByIdFn>;
        const knowledgeCreateMemoryMock = mock(() => Promise.resolve()) as Mock<CreateMemoryFn>;
        const documentsCreateMemoryMock = mock(() => Promise.resolve()) as Mock<CreateMemoryFn>;

        mockRuntime = {
            agentId: "test-agent",
            messageManager: {
                getCachedEmbeddings: mock(() => Promise.resolve([])),
            },
            knowledgeManager: {
                searchMemories: searchMemoriesMock,
                createMemory: knowledgeCreateMemoryMock,  // Use separate mock
            },
            documentsManager: {
                getMemoryById: getMemoryByIdMock,
                createMemory: documentsCreateMemoryMock,  // Use separate mock
            },
            useModel: mock(() => Promise.resolve([])),
        } as unknown as AgentRuntime;

        // Mock splitChunks to return predictable chunks
        mockSplitChunks.mockImplementation(async () => [
            "chunk1",
            "chunk2",
            "chunk3"
        ]);
    });

    describe("preprocess", () => {
        it("should handle invalid inputs", () => {
            expect(knowledge.preprocess(null as any)).toBe("");
            expect(knowledge.preprocess(undefined as any)).toBe("");
            expect(knowledge.preprocess("")).toBe("");
        });

        it("should remove code blocks and inline code", () => {
            const input =
                "Here is some code: ```const x = 1;``` and `inline code`";
            expect(knowledge.preprocess(input)).toBe("here is some code: and");
        });

        it("should handle markdown formatting", () => {
            const input =
                "# Header\n## Subheader\n[Link](http://example.com)\n![Image](image.jpg)";
            expect(knowledge.preprocess(input)).toBe(
                "header subheader link image"
            );
        });

        it("should simplify URLs", () => {
            const input = "Visit https://www.example.com/path?param=value";
            expect(knowledge.preprocess(input)).toBe(
                "visit example.com/path?param=value"
            );
        });

        it("should remove Discord mentions and HTML tags", () => {
            const input = "Hello <@123456789> and <div>HTML content</div>";
            expect(knowledge.preprocess(input)).toBe("hello and html content");
        });

        it("should normalize whitespace and newlines", () => {
            const input = "Multiple    spaces\n\n\nand\nnewlines";
            expect(knowledge.preprocess(input)).toBe(
                "multiple spaces and newlines"
            );
        });

        it("should remove comments", () => {
            const input = "/* Block comment */ Normal text // Line comment";
            expect(knowledge.preprocess(input)).toBe("normal text");
        });
    });

    describe("get and set", () => {
        describe("get", () => {
            it("should handle invalid messages", async () => {
                const invalidMessage = {} as Memory;
                const result = await knowledge.get(mockRuntime, invalidMessage);
                expect(result).toEqual([]);
            });

            it("should handle empty processed text", async () => {
                const message: Memory = {
                    agentId: "test-agent",
                    content: { text: "```code only```" },
                } as unknown as Memory;

                const result = await knowledge.get(mockRuntime, message);
                expect(result).toEqual([]);
            });
        });
    });

    describe("Document and Fragment Management", () => {
        it("should store document and create fragments", async () => {
            // Reset mock counters before test
            (mockRuntime.knowledgeManager.createMemory as Mock<CreateMemoryFn>).mockReset();
            (mockRuntime.documentsManager.createMemory as Mock<CreateMemoryFn>).mockReset();
            mockSplitChunks.mockReset();
            
            // Log what's happening
            console.log('Setting up mock splitChunks...');
            mockSplitChunks.mockImplementation(async (text: string) => {
                const chunks = ["chunk1", "chunk2", "chunk3"];
                console.log('splitChunks called with:', text);
                console.log('returning chunks:', chunks);
                return chunks;
            });

            const item: KnowledgeItem = {
                id: TEST_UUID_1,
                content: {
                    text: "test document content"
                }
            };

            console.log('Calling knowledge.set...');
            console.log('Item content:', item.content);
            await knowledge.set(mockRuntime, item);
            console.log('After knowledge.set');

            // Log mock calls
            console.log('knowledgeManager.createMemory calls:', 
                (mockRuntime.knowledgeManager.createMemory as Mock<CreateMemoryFn>).mock.calls.length);
            console.log('documentsManager.createMemory calls:', 
                (mockRuntime.documentsManager.createMemory as Mock<CreateMemoryFn>).mock.calls.length);
            console.log('splitChunks calls:', mockSplitChunks.mock.calls.length);

            // Verify document creation
            expect(mockRuntime.documentsManager.createMemory).toHaveBeenCalledTimes(1);  // Document should be created once
            expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalledTimes(3);  // Three fragments should be created
            
            // Check first fragment
            expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: { text: "chunk1" },
                    metadata: expect.objectContaining({
                        type: "fragment",
                        documentId: TEST_UUID_1,
                        position: 0
                    })
                })
            );
        });

        it("should retrieve documents through fragment search", async () => {
            const mockFragment: Memory = {
                id: TEST_UUID_2,
                userId: TEST_UUID_1,
                roomId: TEST_UUID_1,
                content: { 
                    text: "fragment text",
                    source: TEST_UUID_1 
                },
                metadata: {
                    type: "fragment",
                    documentId: TEST_UUID_1,
                    position: 0
                }
            };

            const mockDocument: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_1,
                roomId: TEST_UUID_1,
                content: { text: "full document" },
                metadata: {
                    type: "document"
                }
            };

            // Now these will work with proper typing
            (mockRuntime.knowledgeManager.searchMemories as Mock<SearchMemoriesFn>).mockResolvedValue([mockFragment]);
            (mockRuntime.documentsManager.getMemoryById as Mock<GetMemoryByIdFn>).mockResolvedValue(mockDocument);

            const result = await knowledge.get(mockRuntime, {
                userId: TEST_UUID_1,
                roomId: TEST_UUID_1,
                content: { text: "query" }
            } as Memory);

            expect(result).toHaveLength(1);
            expect(result[0].content).toEqual(mockDocument.content);
        });
    });
});

