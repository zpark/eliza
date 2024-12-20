import { Service } from "@ai16z/eliza";

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

export interface NFTKnowledge {
    mentionsCollection: boolean;
    mentionsFloorPrice: boolean;
    mentionsVolume: boolean;
    mentionsRarity: boolean;
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
}
