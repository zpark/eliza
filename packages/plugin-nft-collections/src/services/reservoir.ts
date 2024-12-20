import { Service, ServiceType } from "@ai16z/eliza";
import {
    NFTCollection,
    NFTListing,
    NFTMarketStats,
    NFTService,
    OnChainAnalytics,
    MarketActivity,
    CollectionNews,
    NFTArtist,
} from "../types";

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

    private async fetch<T>(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<T> {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            headers: {
                "x-api-key": this.apiKey,
                accept: "*/*",
            },
        });

        if (!response.ok) {
            throw new Error(`Reservoir API error: ${response.statusText}`);
        }

        return response.json();
    }

    async getTopCollections({ limit = 10 } = {}): Promise<NFTCollection[]> {
        const data = await this.fetch<any>("/collections/v7", {
            limit: limit.toString(),
            sortBy: "1DayVolume",
            includeTopBid: "true",
            normalizeRoyalties: "true",
        });

        return data.collections.map((collection: any) => ({
            id: collection.id,
            name: collection.name,
            address: collection.primaryContract,
            floorPrice: collection.floorAsk?.price?.amount?.native || 0,
            volume24h: collection.volume?.["1day"] || 0,
            imageUrl: collection.image,
            tokenCount: collection.tokenCount,
            description: collection.description,
            // Map other fields as needed
        }));
    }

    async getFloorListings({
        collection,
        limit,
        sortBy = "price",
    }: {
        collection: string;
        limit: number;
        sortBy?: "price" | "rarity";
    }): Promise<NFTListing[]> {
        const data = await this.fetch<any>("/orders/asks/v5", {
            collection,
            limit: limit.toString(),
            sortBy: sortBy === "price" ? "price" : "tokenRank",
        });

        return data.orders.map((order: any) => ({
            id: order.id,
            tokenId: order.token.tokenId,
            price: order.price?.amount?.native || 0,
            source: order.source?.name || "unknown",
            validFrom: order.validFrom,
            validUntil: order.validUntil,
        }));
    }

    // Implement other methods as needed
    async executeBuy(params: {
        listings: NFTListing[];
        taker: string;
        source?: string;
    }): Promise<{
        path: string;
        steps: {
            id: string;
            action: string;
            description: string;
            status: "complete" | "incomplete";
        }[];
    }> {
        throw new Error("Method not implemented.");
    }

    async getMarketStats(): Promise<NFTMarketStats> {
        throw new Error("Method not implemented.");
    }

    async getCollectionAnalytics(address: string): Promise<OnChainAnalytics> {
        throw new Error("Method not implemented.");
    }

    async getCollectionNews(
        address: string,
        options?: { limit?: number; minRelevance?: number }
    ): Promise<CollectionNews[]> {
        throw new Error("Method not implemented.");
    }

    async getArtistInfo(artistId: string): Promise<NFTArtist> {
        throw new Error("Method not implemented.");
    }

    async getMarketActivity(
        address: string,
        options?: {
            timeframe?: "24h" | "7d" | "30d";
            excludeWashTrading?: boolean;
        }
    ): Promise<MarketActivity> {
        throw new Error("Method not implemented.");
    }
}
