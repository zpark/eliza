import axios, { AxiosError } from "axios";
import { Service, ServiceType, IAgentRuntime } from "@ai16z/eliza";
import type { CacheManager } from "./cache-manager";
import type { RateLimiter } from "./rate-limiter";
import { NFTCollection } from "../constants/collections";
import { COLLECTIONS_BY_ADDRESS } from "../constants/curated-collections";
import pRetry from "p-retry";
import pQueue from "p-queue";

interface ReservoirConfig {
    cacheManager?: CacheManager;
    rateLimiter?: RateLimiter;
    maxConcurrent?: number;
    maxRetries?: number;
    batchSize?: number;
}

interface RequestQueueItem {
    priority: number;
    fn: () => Promise<any>;
}

export class ReservoirService extends Service {
    private apiKey: string;
    private baseUrl = "https://api.reservoir.tools";
    private cacheManager?: CacheManager;
    private rateLimiter?: RateLimiter;
    protected runtime?: IAgentRuntime;
    private requestQueue: pQueue;
    private maxRetries: number;
    private batchSize: number;

    constructor(apiKey: string, config?: ReservoirConfig) {
        super();
        this.apiKey = apiKey;
        this.cacheManager = config?.cacheManager;
        this.rateLimiter = config?.rateLimiter;
        this.maxRetries = config?.maxRetries || 3;
        this.batchSize = config?.batchSize || 20;

        // Initialize request queue with concurrency control
        this.requestQueue = new pQueue({
            concurrency: config?.maxConcurrent || 5,
        });
    }

    static override get serviceType(): ServiceType {
        return "nft" as ServiceType;
    }

    override async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        if (!this.apiKey) {
            throw new Error("Reservoir API key is required");
        }
    }

    private getRequestPriority(address: string): number {
        return COLLECTIONS_BY_ADDRESS.has(address.toLowerCase()) ? 1 : 0;
    }

    private async makeRequest<T>(
        endpoint: string,
        params: Record<string, any> = {},
        priority: number = 0
    ): Promise<T> {
        const cacheKey = `reservoir:${endpoint}:${JSON.stringify(params)}`;

        // Check cache first
        if (this.cacheManager) {
            const cached = await this.cacheManager.get<T>(cacheKey);
            if (cached) return cached;
        }

        // Add request to queue with priority
        return this.requestQueue.add(
            async () => {
                // Check rate limit
                if (this.rateLimiter) {
                    await this.rateLimiter.checkLimit("reservoir");
                }

                // Implement retry logic with exponential backoff
                return pRetry(
                    async () => {
                        try {
                            const response = await axios.get(
                                `${this.baseUrl}${endpoint}`,
                                {
                                    params,
                                    headers: {
                                        "x-api-key": this.apiKey,
                                    },
                                }
                            );

                            // Cache successful response
                            if (this.cacheManager) {
                                const ttl = priority > 0 ? 3600000 : 1800000; // Longer TTL for curated collections (1h vs 30m)
                                await this.cacheManager.set(
                                    cacheKey,
                                    response.data,
                                    ttl
                                );
                            }

                            return response.data;
                        } catch (error) {
                            if (error instanceof AxiosError) {
                                // Retry on specific error codes
                                if (
                                    error.response?.status === 429 ||
                                    error.response?.status >= 500
                                ) {
                                    throw error;
                                }
                            }
                            console.error("Reservoir API error:", error, {
                                endpoint,
                                params,
                            });
                            throw error;
                        }
                    },
                    {
                        retries: this.maxRetries,
                        onFailedAttempt: (error) => {
                            console.warn(
                                `Attempt ${error.attemptNumber} failed. ${
                                    this.maxRetries - error.attemptNumber
                                } attempts remaining.`
                            );
                        },
                    }
                );
            },
            { priority }
        );
    }

    async getCollections(addresses: string[]): Promise<NFTCollection[]> {
        // Split addresses into batches
        const batches = [];
        for (let i = 0; i < addresses.length; i += this.batchSize) {
            batches.push(addresses.slice(i, i + this.batchSize));
        }

        // Process batches with priority
        const results = await Promise.all(
            batches.map(async (batch) => {
                const priority = Math.max(
                    ...batch.map((addr) => this.getRequestPriority(addr))
                );
                const data = await this.makeRequest<any>(
                    `/collections/v6`,
                    { contract: batch.join(",") },
                    priority
                );
                return data.collections;
            })
        );

        // Flatten and transform results
        return results.flat().map((collection: any) => ({
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

    async getCollection(address: string): Promise<NFTCollection> {
        const collections = await this.getCollections([address]);
        return collections[0];
    }

    async getTopCollections(limit: number = 10): Promise<NFTCollection[]> {
        const priority = 1; // High priority for top collections
        const data = await this.makeRequest<any>(
            `/collections/v6`,
            {
                limit,
                sortBy: "volume24h",
            },
            priority
        );

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
        const priority = this.getRequestPriority(address);
        return this.makeRequest<any>(
            `/collections/v6/stats`,
            { contract: address },
            priority
        );
    }

    async getCollectionActivity(address: string, limit: number = 20) {
        const priority = this.getRequestPriority(address);
        return this.makeRequest<any>(
            `/collections/v6/activity`,
            { contract: address, limit },
            priority
        );
    }

    async getTokens(address: string, limit: number = 20) {
        const priority = this.getRequestPriority(address);
        return this.makeRequest<any>(
            `/tokens/v6`,
            { contract: address, limit },
            priority
        );
    }

    async getFloorPrice(address: string) {
        const priority = this.getRequestPriority(address);
        const data = await this.makeRequest<any>(
            `/collections/v6/floor-ask`,
            { contract: address },
            priority
        );
        return data.floorAsk?.price?.amount?.native || 0;
    }
}
