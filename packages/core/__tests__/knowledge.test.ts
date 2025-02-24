import { describe, expect, it, mock, beforeEach } from "bun:test";
import knowledge from "../src/knowledge";
import type { AgentRuntime } from "../src/runtime";
import type { Memory } from "../src/types";

// Mock modules
const mockSplitChunks = mock(async (text: string) => [text]);
const mockStringToUuid = mock((str: string) => str);

// Mock the imports
mock.module("../generation", () => ({
    splitChunks: mockSplitChunks,
}));

mock.module("../uuid", () => ({
    stringToUuid: mockStringToUuid,
}));

describe("Knowledge Module", () => {
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
        let mockRuntime: AgentRuntime;

        beforeEach(() => {
            mockRuntime = {
                agentId: "test-agent",
                messageManager: {
                    getCachedEmbeddings: mock(() => Promise.resolve([])),
                },
                knowledgeManager: {
                    searchMemories: mock(() =>
                        Promise.resolve([
                            {
                                content: {
                                    text: "test fragment",
                                    source: "source1",
                                },
                                similarity: 0.9,
                            },
                        ])
                    ),
                    createMemory: mock(() => Promise.resolve(undefined)),
                },
                documentsManager: {
                    getMemoryById: mock(() =>
                        Promise.resolve({
                            id: "source1",
                            content: { text: "test document" },
                        })
                    ),
                    createMemory: mock(() => Promise.resolve(undefined)),
                },
            } as unknown as AgentRuntime;
        });

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
});

