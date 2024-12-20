import { Service } from "@ai16z/eliza";

declare module "@ai16z/eliza" {
    interface ServiceTypeMap {
        nft: Service & NFTService;
    }
}

export interface NFTCollection {
    id: string;
    name: string;
    address: string;
    floorPrice: number;
    volume24h: number;
    imageUrl: string;
    tokenCount: number;
}

export interface NFTListing {
    id: string;
    tokenId: string;
    price: number;
    source: string;
    validFrom: number;
    validUntil: number;
}

export interface NFTMarketStats {
    totalVolume24h: number;
    totalMarketCap: number;
    activeTraders24h: number;
    topGainers: Array<{
        collection: string;
        percentageChange: number;
    }>;
    topLosers: Array<{
        collection: string;
        percentageChange: number;
    }>;
    marketSentiment: "bullish" | "bearish" | "neutral";
}

export interface NFTKnowledge {
    mentionsCollection: boolean;
    mentionsFloorPrice: boolean;
    mentionsVolume: boolean;
    mentionsRarity: boolean;
    mentionsMarketTrends: boolean;
    mentionsTraders: boolean;
    mentionsSentiment: boolean;
    mentionsMarketCap: boolean;
}

export interface NFTService {
    getTopCollections(options?: { limit?: number }): Promise<NFTCollection[]>;
    getFloorListings(params: {
        collection: string;
        limit: number;
        sortBy?: "price" | "rarity";
    }): Promise<NFTListing[]>;
    executeBuy(params: {
        listings: NFTListing[];
        taker: string;
        source?: string;
    }): Promise<{
        path: string;
        steps: Array<{
            id: string;
            action: string;
            description: string;
            status: "complete" | "incomplete";
        }>;
    }>;
    getMarketStats(): Promise<NFTMarketStats>;
}
