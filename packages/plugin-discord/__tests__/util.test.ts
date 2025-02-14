import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getWavHeader,
    generateSummary,
    sendMessageInChunks,
    canSendMessage
} from "../src/utils.ts";
import { ChannelType, PermissionsBitField, Client, TextChannel, ThreadChannel } from "discord.js";

// Mock runtime for generateSummary
const mockRuntime = {
    getService: vi.fn(),
};


vi.mock("@elizaos/core", () => ({
    trimTokens: vi.fn((text) => Promise.resolve(text)),
    parseJSONObjectFromText: vi.fn((text) => JSON.parse(text)),
    ModelClass: { TEXT_SMALL: "TEXT_SMALL" },
    logger: {
        error: vi.fn(),
    },
}));

describe("Utility Functions", () => {
    describe("getWavHeader", () => {
        it("should generate a valid WAV header", () => {
            const header = getWavHeader(1000, 44100, 2, 16);
            expect(header).toBeInstanceOf(Buffer);
            expect(header.length).toBe(44);
            expect(header.toString("utf8", 0, 4)).toBe("RIFF");
            expect(header.toString("utf8", 8, 12)).toBe("WAVE");
        });
    });


    describe("sendMessageInChunks", () => {
        let mockChannel;
        beforeEach(() => {
            mockChannel = {
                send: vi.fn().mockResolvedValue({ id: "message-id" }),
            } as unknown as TextChannel;
        });

        it("should split and send messages in chunks", async () => {
            const longMessage = "A".repeat(4000);
            const messages = await sendMessageInChunks(mockChannel, longMessage, "reply-id", []);

            expect(messages.length).toBeGreaterThan(1);
            expect(mockChannel.send).toHaveBeenCalledTimes(messages.length);
        });
    });
});
