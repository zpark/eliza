import axios from "axios";
import { Service, ServiceType, IAgentRuntime } from "@ai16z/eliza";
import type { CacheManager } from "./cache-manager";
import type { RateLimiter } from "./rate-limiter";
import { NFTCollection } from "../constants/collections";

interface ReservoirConfig {
    cacheManager?: CacheManager;
    rateLimiter?: RateLimiter;
}

export class ReservoirService extends Service {
    private apiKey: string;
    private baseUrl = "https://api.reservoir.tools";
    private cacheManager?: CacheManager;
    private rateLimiter?: RateLimiter;
    protected runtime?: IAgentRuntime;

    constructor(apiKey: string, config?: ReservoirConfig) {
        super();
        this.apiKey = apiKey;
        this.cacheManager = config?.cacheManager;
        this.rateLimiter = config?.rateLimiter;
    }

    static override get serviceType(): ServiceType {
        return "nft" as ServiceType;
    }

    override async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        // Initialize any required resources
        if (!this.apiKey) {
            throw new Error("Reservoir API key is required");
        }
    }

    private async makeRequest<T>(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<T> {
        const cacheKey = `reservoir:${endpoint}:${JSON.stringify(params)}`;

        // Check cache first
        if (this.cacheManager) {
            const cached = await this.cacheManager.get<T>(cacheKey);
            if (cached) return cached;
        }

        // Check rate limit
        if (this.rateLimiter) {
            await this.rateLimiter.checkLimit("reservoir");
        }

        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                params,
                headers: {
                    "x-api-key": this.apiKey,
                },
            });

            // Cache the response
            if (this.cacheManager) {
                await this.cacheManager.set(cacheKey, response.data);
            }

            return response.data;
        } catch (error) {
            console.error("Reservoir API error:", error);
            throw error;
        }
    }

    async getCollection(address: string): Promise<NFTCollection> {
        const data = await this.makeRequest<any>(`/collections/v6`, {
            contract: address,
        });

        return {
            address: data.collections[0].id,
            name: data.collections[0].name,
            symbol: data.collections[0].symbol,
            description: data.collections[0].description,
            imageUrl: data.collections[0].image,
            externalUrl: data.collections[0].externalUrl,
            twitterUsername: data.collections[0].twitterUsername,
            discordUrl: data.collections[0].discordUrl,
            verified:
                data.collections[0].openseaVerificationStatus === "verified",
            floorPrice:
                data.collections[0].floorAsk?.price?.amount?.native || 0,
            volume24h: data.collections[0].volume24h || 0,
            marketCap: data.collections[0].marketCap || 0,
            totalSupply: data.collections[0].tokenCount || 0,
        };
    }

    async getTopCollections(limit: number = 10): Promise<NFTCollection[]> {
        const data = await this.makeRequest<any>(`/collections/v6`, {
            limit,
            sortBy: "volume24h",
        });

        return data.collections.map((collection: any) => ({
            address: collection.id,
            name: collection.name,
            symbol: collection.symbol,
            description: collection.description,
            imageUrl: collection.image,
            externalUrl: collection.externalUrl,
            twitterUsername: collection.twitterUsername,
            discordUrl: collection.discordUrl,
            verified: collection.openseaVerificationStatus === "verified",
            floorPrice: collection.floorAsk?.price?.amount?.native || 0,
            volume24h: collection.volume24h || 0,
            marketCap: collection.marketCap || 0,
            totalSupply: collection.tokenCount || 0,
        }));
    }

    async getMarketStats(address: string) {
        return this.makeRequest<any>(`/collections/v6/stats`, {
            contract: address,
        });
    }

    async getCollectionActivity(address: string, limit: number = 20) {
        return this.makeRequest<any>(`/collections/v6/activity`, {
            contract: address,
            limit,
        });
    }

    async getTokens(address: string, limit: number = 20) {
        return this.makeRequest<any>(`/tokens/v6`, {
            contract: address,
            limit,
        });
    }

    async getFloorPrice(address: string) {
        const data = await this.makeRequest<any>(`/collections/v6/floor-ask`, {
            contract: address,
        });
        return data.floorAsk?.price?.amount?.native || 0;
    }
}
