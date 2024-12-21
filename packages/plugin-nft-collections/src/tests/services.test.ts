import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { ReservoirService } from "../services/reservoir";
import { SocialAnalyticsService } from "../services/social-analytics";
import {
    MemoryCacheManager,
    type CacheManager,
} from "../services/cache-manager";
import { RateLimiter } from "../services/rate-limiter";
import type { NFTCollection } from "../types";

describe("NFT Services", () => {
    describe("ReservoirService", () => {
        const apiKey = "test-api-key";
        let service: ReservoirService;
        let cacheManager: CacheManager;
        let rateLimiter: RateLimiter;

        beforeEach(() => {
            cacheManager = new MemoryCacheManager(3600000);
            rateLimiter = new RateLimiter({
                maxRequests: 100,
                windowMs: 60000,
            });

            service = new ReservoirService(apiKey, {
                cacheManager,
                rateLimiter,
            });
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

    describe("SocialAnalyticsService", () => {
        let service: SocialAnalyticsService;
        let cacheManager: CacheManager;
        let rateLimiter: RateLimiter;

        beforeEach(() => {
            cacheManager = new MemoryCacheManager(3600000);
            rateLimiter = new RateLimiter({
                maxRequests: 100,
                windowMs: 60000,
            });

            service = new SocialAnalyticsService({
                cacheManager,
                rateLimiter,
                apiKeys: {
                    twitter: "test-twitter-key",
                    discord: "test-discord-key",
                    telegram: "test-telegram-key",
                },
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
