import { describe, expect, it, vi } from "vitest";
import { ReservoirService } from "../services/reservoir";
import { CoinGeckoService } from "../services/coingecko";
import { SocialAnalyticsService } from "../services/social-analytics";
import { MarketIntelligenceService } from "../services/market-intelligence";

describe("NFT Services", () => {
    describe("ReservoirService", () => {
        const apiKey = "test-api-key";
        let service: ReservoirService;

        beforeEach(() => {
            service = new ReservoirService(apiKey);
            global.fetch = vi.fn();
        });

        it("should fetch top collections", async () => {
            const mockResponse = {
                collections: [
                    {
                        id: "test-collection",
                        name: "Test Collection",
                        address: "0x1234",
                        floorPrice: 1.5,
                        volume24h: 100,
                    },
                ],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.getTopCollections();
            expect(result[0].name).toBe("Test Collection");
            expect(result[0].floorPrice).toBe(1.5);
        });

        it("should create listing", async () => {
            const mockResponse = {
                listingId: "test-listing",
                status: "active",
                marketplaceUrl: "https://ikigailabs.xyz/listing/test",
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.createListing({
                tokenId: "123",
                collectionAddress: "0x1234",
                price: 1.5,
                marketplace: "ikigailabs",
            });

            expect(result.listingId).toBe("test-listing");
            expect(result.status).toBe("active");
        });
    });

    describe("CoinGeckoService", () => {
        let service: CoinGeckoService;

        beforeEach(() => {
            service = new CoinGeckoService();
            global.fetch = vi.fn();
        });

        it("should fetch NFT market data", async () => {
            const mockResponse = {
                id: "test-collection",
                contract_address: "0x1234",
                name: "Test Collection",
                asset_platform_id: "ethereum",
                symbol: "TEST",
                market_cap_usd: 10000,
                volume_24h_usd: 1000,
                floor_price_usd: 1.5,
                floor_price_eth: 0.5,
                total_supply: 10000,
                market_cap_eth: 5000,
                volume_24h_eth: 100,
                number_of_unique_addresses: 1000,
                number_of_unique_currencies: 1,
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.getNFTMarketData("0x1234");
            expect(result?.floor_price_eth).toBe(0.5);
            expect(result?.volume_24h_eth).toBe(100);
        });
    });

    describe("SocialAnalyticsService", () => {
        let service: SocialAnalyticsService;

        beforeEach(() => {
            service = new SocialAnalyticsService({
                twitter: "twitter-key",
                discord: "discord-key",
                telegram: "telegram-key",
                alchemy: "alchemy-key",
                nftscan: "nftscan-key",
            });
            global.fetch = vi.fn();
        });

        it("should fetch social metrics", async () => {
            const mockResponse = {
                twitter: {
                    followers: 10000,
                    engagement: {
                        likes: 500,
                        retweets: 200,
                        replies: 300,
                    },
                },
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.getSocialMetrics("test-collection");
            expect(result.twitter.followers).toBe(10000);
            expect(result.twitter.engagement.likes).toBe(500);
        });
    });

    describe("MarketIntelligenceService", () => {
        let service: MarketIntelligenceService;

        beforeEach(() => {
            service = new MarketIntelligenceService({
                nansen: "nansen-key",
                dune: "dune-key",
                alchemy: "alchemy-key",
                chainbase: "chainbase-key",
                nftscan: "nftscan-key",
            });
            global.fetch = vi.fn();
        });

        it("should detect wash trading", async () => {
            const mockResponse = {
                suspiciousAddresses: ["0x123", "0x456"],
                suspiciousTransactions: [
                    {
                        hash: "0xabc",
                        from: "0x123",
                        to: "0x456",
                        price: 1.5,
                        confidence: 0.9,
                    },
                ],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.detectWashTrading("test-collection");
            expect(result.suspiciousAddresses).toHaveLength(2);
            expect(result.suspiciousTransactions[0].confidence).toBe(0.9);
        });
    });
});
