import { Service, ServiceType } from "@ai16z/eliza";
import type { NFTCollection, MarketStats, NFTService } from "../types";

export class ReservoirService extends Service implements NFTService {
    private apiKey: string;
    private baseUrl = "https://api.reservoir.tools";

    constructor(apiKey: string) {
        super();
        this.apiKey = apiKey;
    }

    static get serviceType(): ServiceType {
        return "nft" as ServiceType;
    }

    async initialize(): Promise<void> {
        // No initialization needed
    }

    private async fetchFromReservoir(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<any> {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            headers: {
                accept: "*/*",
                "x-api-key": this.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`Reservoir API error: ${response.statusText}`);
        }

        return await response.json();
    }

    async getTopCollections(): Promise<NFTCollection[]> {
        const data = await this.fetchFromReservoir("/collections/v7", {
            limit: 20,
            sortBy: "1DayVolume",
            includeTopBid: true,
            normalizeRoyalties: true,
        });

        return data.collections.map((collection: any) => ({
            address: collection.id,
            name: collection.name,
            symbol: collection.symbol || "",
            description: collection.description,
            imageUrl: collection.image,
            floorPrice: collection.floorAsk?.price?.amount?.native || 0,
            volume24h: collection.volume["1day"] || 0,
            marketCap: collection.marketCap || 0,
            holders: collection.ownerCount || 0,
        }));
    }

    async getMarketStats(): Promise<MarketStats> {
        const data = await this.fetchFromReservoir("/collections/v7", {
            limit: 500,
            sortBy: "1DayVolume",
        });

        const stats = data.collections.reduce(
            (acc: any, collection: any) => {
                acc.totalVolume24h += collection.volume["1day"] || 0;
                acc.totalMarketCap += collection.marketCap || 0;
                acc.totalHolders += collection.ownerCount || 0;
                acc.floorPrices.push(
                    collection.floorAsk?.price?.amount?.native || 0
                );
                return acc;
            },
            {
                totalVolume24h: 0,
                totalMarketCap: 0,
                totalHolders: 0,
                floorPrices: [],
            }
        );

        return {
            totalVolume24h: stats.totalVolume24h,
            totalMarketCap: stats.totalMarketCap,
            totalCollections: data.collections.length,
            totalHolders: stats.totalHolders,
            averageFloorPrice:
                stats.floorPrices.reduce((a: number, b: number) => a + b, 0) /
                stats.floorPrices.length,
        };
    }

    async getCollectionActivity(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(`/collections/activity/v6`, {
            collection: collectionAddress,
            limit: 100,
            includeMetadata: true,
        });
    }

    async getCollectionTokens(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(`/tokens/v7`, {
            collection: collectionAddress,
            limit: 100,
            includeAttributes: true,
            includeTopBid: true,
        });
    }

    async getCollectionAttributes(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(
            `/collections/${collectionAddress}/attributes/v3`
        );
    }

    async getFloorListings(options: {
        collection: string;
        limit: number;
        sortBy: "price" | "rarity";
    }): Promise<
        Array<{
            tokenId: string;
            price: number;
            seller: string;
            marketplace: string;
        }>
    > {
        const data = await this.fetchFromReservoir(`/tokens/v7`, {
            collection: options.collection,
            limit: options.limit,
            sortBy: options.sortBy === "price" ? "floorAskPrice" : "rarity",
            includeTopBid: true,
            status: "listed",
        });

        return data.tokens.map((token: any) => ({
            tokenId: token.tokenId,
            price: token.floorAsk.price.amount.native,
            seller: token.floorAsk.maker,
            marketplace: token.floorAsk.source.name,
        }));
    }

    async executeBuy(options: {
        listings: Array<{
            tokenId: string;
            price: number;
            seller: string;
            marketplace: string;
        }>;
        taker: string;
    }): Promise<{
        path: string;
        steps: Array<{
            action: string;
            status: string;
        }>;
    }> {
        // Execute buy orders through Reservoir API
        const orders = options.listings.map((listing) => ({
            tokenId: listing.tokenId,
            maker: listing.seller,
            price: listing.price,
        }));

        const data = await this.fetchFromReservoir(`/execute/bulk/v1`, {
            taker: options.taker,
            items: orders,
            skipBalanceCheck: false,
            currency: "ETH",
        });

        return {
            path: data.path,
            steps: data.steps.map((step: any) => ({
                action: step.type,
                status: step.status,
            })),
        };
    }
}
