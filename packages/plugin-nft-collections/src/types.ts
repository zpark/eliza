import { Service, ServiceType } from "@ai16z/eliza";

declare module "@ai16z/eliza" {
    interface ServiceTypeMap {
        nft: Service & NFTService;
    }
}

export interface NFTArtist {
    id: string;
    name: string;
    bio: string;
    socialLinks: {
        twitter?: string;
        instagram?: string;
        website?: string;
    };
    previousCollections: string[];
    collaborations: string[];
}

export interface OnChainAnalytics {
    holdersCount: number;
    averageHoldingPeriod: number;
    whaleHolders: Array<{
        address: string;
        tokenCount: number;
        holdingSince: number;
    }>;
    transferVolume24h: number;
    uniqueBuyers24h: number;
    uniqueSellers24h: number;
    liquidityDepth: Array<{
        priceLevel: number;
        tokenCount: number;
    }>;
    traitDistribution: Record<string, Record<string, number>>;
    rarityScores: Record<string, number>;
}

export interface MarketActivity {
    lastSales: Array<{
        tokenId: string;
        price: number;
        timestamp: number;
        buyer: string;
        seller: string;
        marketplace: string;
    }>;
    priceHistory: Array<{
        timestamp: number;
        floorPrice: number;
        avgPrice: number;
        maxPrice: number;
    }>;
    washTradingScore: number;
    marketplaceDistribution: Record<string, number>;
}

export interface CollectionNews {
    id: string;
    title: string;
    source: string;
    url: string;
    timestamp: number;
    sentiment: "positive" | "negative" | "neutral";
    relevanceScore: number;
}

export interface NFTCollection {
    id: string;
    name: string;
    address: string;
    floorPrice: number;
    volume24h: number;
    imageUrl: string;
    tokenCount: number;
    artist: NFTArtist;
    description: string;
    launchDate: number;
    category: string[];
    onChainData: OnChainAnalytics;
    marketActivity: MarketActivity;
    news: CollectionNews[];
    socialMetrics: {
        twitterFollowers: number;
        discordMembers: number;
        telegramMembers: number;
        sentiment24h: "positive" | "negative" | "neutral";
    };
    contractMetadata: {
        standard: "ERC721" | "ERC1155";
        hasSecondaryRoyalties: boolean;
        royaltyBps: number;
        verifiedContract: boolean;
        implementedInterfaces: string[];
    };
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
    mentionsArtist: boolean;
    mentionsOnChainData: boolean;
    mentionsNews: boolean;
    mentionsSocial: boolean;
    mentionsContract: boolean;
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
    getCollectionAnalytics(address: string): Promise<OnChainAnalytics>;
    getCollectionNews(
        address: string,
        options?: { limit?: number; minRelevance?: number }
    ): Promise<CollectionNews[]>;
    getArtistInfo(artistId: string): Promise<NFTArtist>;
    getMarketActivity(
        address: string,
        options?: {
            timeframe?: "24h" | "7d" | "30d";
            excludeWashTrading?: boolean;
        }
    ): Promise<MarketActivity>;
}
