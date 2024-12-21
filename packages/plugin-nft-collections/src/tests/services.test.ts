import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { ReservoirService } from "../services/reservoir";
import { CoinGeckoService } from "../services/coingecko";
import { SocialAnalyticsService } from "../services/social-analytics";
import type { NFTCollection } from "../types";

describe("NFT Services", () => {
    describe("ReservoirService", () => {
        const apiKey = "test-api-key";
        let service: ReservoirService;

        beforeEach(() => {
            service = new ReservoirService(apiKey);
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            collections: [
                                {
                                    id: "0x1234",
                                    name: "Test Collection",
                                    symbol: "TEST",
                                    description: "Test Description",
                                    image: "https://test.com/image.png",
                                    floorAsk: {
                                        price: { amount: { native: 1.5 } },
                                    },
                                    volume: { "1day": 100 },
                                    marketCap: 1000,
                                    ownerCount: 500,
                                },
                            ],
                        }),
                } as Response)
            );
        });

        it("should fetch top collections", async () => {
            const collections = await service.getTopCollections();
            expect(collections[0].name).toBe("Test Collection");
            expect(collections[0].floorPrice).toBe(1.5);
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    describe("CoinGeckoService", () => {
        let service: CoinGeckoService;

        beforeEach(() => {
            service = new CoinGeckoService();
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            id: "test-collection",
                            contract_address: "0x1234",
                            name: "Test Collection",
                            floor_price_eth: 1.5,
                            volume_24h_eth: 100,
                        }),
                } as Response)
            );
        });

        it("should fetch NFT market data", async () => {
            const data = await service.getNFTMarketData("0x1234");
            expect(data?.floor_price_eth).toBe(1.5);
            expect(data?.volume_24h_eth).toBe(100);
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    describe("SocialAnalyticsService", () => {
        let service: SocialAnalyticsService;

        beforeEach(() => {
            service = new SocialAnalyticsService({
                twitter: "twitter-key",
                nftscan: "nftscan-key",
            });
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            twitter: {
                                followers: 10000,
                                engagement: {
                                    likes: 500,
                                    retweets: 200,
                                    replies: 300,
                                    mentions: 150,
                                },
                                sentiment: {
                                    positive: 0.7,
                                    neutral: 0.2,
                                    negative: 0.1,
                                },
                            },
                            mentions: [],
                            influencers: [],
                            trending: true,
                        }),
                } as Response)
            );
        });

        it("should fetch social metrics", async () => {
            const metrics = await service.getSocialMetrics("0x1234");
            expect(metrics.twitter.followers).toBe(10000);
            expect(metrics.twitter.engagement.likes).toBe(500);
            expect(metrics.trending).toBe(true);
            expect(global.fetch).toHaveBeenCalled();
        });
    });
});
