import { defaultCharacter } from "@elizaos/core";
import axios from "axios";
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import getPriceAction from "../actions/getPrice";

// Mock axios
vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
    },
}));

describe("getPrice Action", () => {
    let mockedRuntime;

    beforeAll(() => {
        mockedRuntime = {
            character: defaultCharacter,
            getSetting: vi.fn().mockReturnValue("test-api-key"),
            composeState: vi.fn().mockResolvedValue({
                recentMessages: [
                    {
                        id: "1",
                        timestamp: Date.now(),
                        content: {
                            text: "What is the price of Bitcoin?",
                        },
                        user: "user1",
                    },
                ],
            }),
            updateRecentMessageState: vi
                .fn()
                .mockImplementation((state) => state),
        };
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe("Price Checking", () => {
        it("should validate configuration successfully", async () => {
            const result = await getPriceAction.validate(mockedRuntime, {
                id: "1",
                timestamp: Date.now(),
                content: { text: "Check BTC price" },
                user: "user1",
            });

            expect(result).toBe(true);
        });

        it("should handle price fetch successfully", async () => {
            const mockAxiosResponse = {
                data: {
                    bitcoin: {
                        usd: 50000,
                    },
                },
            };

            (axios.get as any).mockResolvedValueOnce(mockAxiosResponse);

            const mockCallback = vi.fn();

            const result = await getPriceAction.handler(
                mockedRuntime,
                {
                    id: "1",
                    timestamp: Date.now(),
                    content: { text: "Check BTC price" },
                    user: "user1",
                },
                {
                    recentMessages: [
                        {
                            id: "1",
                            timestamp: Date.now(),
                            content: { text: "Check BTC price" },
                            user: "user1",
                        },
                    ],
                },
                {},
                mockCallback
            );

            expect(result).toBe(true);
            expect(mockCallback).toHaveBeenCalledWith({
                text: expect.stringContaining("50000 USD"),
                content: { price: 50000, currency: "usd" },
            });
        });

        it("should handle API errors gracefully", async () => {
            (axios.get as any).mockRejectedValueOnce(new Error("API Error"));

            const mockCallback = vi.fn();

            const result = await getPriceAction.handler(
                mockedRuntime,
                {
                    id: "1",
                    timestamp: Date.now(),
                    content: { text: "Check BTC price" },
                    user: "user1",
                },
                {
                    recentMessages: [
                        {
                            id: "1",
                            timestamp: Date.now(),
                            content: { text: "Check BTC price" },
                            user: "user1",
                        },
                    ],
                },
                {},
                mockCallback
            );

            expect(result).toBe(false);
            expect(mockCallback).toHaveBeenCalledWith({
                text: expect.stringContaining("Error fetching price"),
                content: { error: "API Error" },
            });
        });
    });
});
