import { Service, IAgentRuntime, ServiceType } from "@ai16z/eliza";
import pRetry from "p-retry";
import pQueue from "p-queue";
import { PerformanceMonitor } from "../utils/performance";
import {
    ErrorHandler,
    NFTErrorFactory,
    ErrorType,
    ErrorCode,
} from "../utils/error-handler";
import { MemoryCacheManager } from "./cache-manager";
import { RateLimiter } from "./rate-limiter";
import { NFTCollection } from "../types";

interface ReservoirServiceConfig {
    cacheManager?: MemoryCacheManager;
    rateLimiter?: RateLimiter;
    maxConcurrent?: number;
    maxRetries?: number;
    batchSize?: number;
}

export class ReservoirService extends Service {
    private apiKey: string;
    private cacheManager?: MemoryCacheManager;
    private rateLimiter?: RateLimiter;
    private queue: pQueue;
    private maxRetries: number;
    private batchSize: number;
    private performanceMonitor: PerformanceMonitor;
    private errorHandler: ErrorHandler;
    protected runtime?: IAgentRuntime;

    constructor(apiKey: string, config: ReservoirServiceConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.cacheManager = config.cacheManager;
        this.rateLimiter = config.rateLimiter;
        this.queue = new pQueue({ concurrency: config.maxConcurrent || 5 });
        this.maxRetries = config.maxRetries || 3;
        this.batchSize = config.batchSize || 20;
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
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

    async makeRequest<T>(
        endpoint: string,
        params: Record<string, any> = {},
        priority: number = 0
    ): Promise<T> {
        const endOperation = this.performanceMonitor.startOperation(
            "makeRequest",
            {
                endpoint,
                params,
                priority,
            }
        );

        try {
            const cacheKey = `reservoir:${endpoint}:${JSON.stringify(params)}`;

            // Check cache first
            if (this.cacheManager) {
                const cached = await this.cacheManager.get<T>(cacheKey);
                if (cached) {
                    endOperation();
                    return cached;
                }
            }

            // Check rate limit
            if (this.rateLimiter) {
                await this.rateLimiter.consume("reservoir", 1);
            }

            // Make the request with retries
            const result = await this.queue.add(
                () =>
                    pRetry(
                        async () => {
                            const response = await fetch(
                                `https://api.reservoir.tools${endpoint}?${new URLSearchParams(
                                    params
                                ).toString()}`,
                                {
                                    headers: {
                                        "x-api-key": this.apiKey,
                                    },
                                }
                            );

                            if (!response.ok) {
                                throw new Error(
                                    `Reservoir API error: ${response.status}`
                                );
                            }

                            return response.json();
                        },
                        {
                            retries: this.maxRetries,
                            onFailedAttempt: (error) => {
                                console.error(
                                    `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
                                );
                            },
                        }
                    ),
                { priority }
            );

            // Cache the result
            if (this.cacheManager) {
                await this.cacheManager.set(cacheKey, result);
            }

            endOperation();
            return result;
        } catch (error) {
            this.performanceMonitor.recordMetric({
                operation: "makeRequest",
                duration: 0,
                success: false,
                metadata: {
                    error: error.message,
                    endpoint,
                    params,
                },
            });

            const nftError = NFTErrorFactory.create(
                ErrorType.API,
                ErrorCode.API_ERROR,
                `API request failed: ${endpoint}`,
                { originalError: error },
                true
            );
            this.errorHandler.handleError(nftError);
            throw error;
        }
    }

    async getTopCollections(limit: number = 10): Promise<NFTCollection[]> {
        const endOperation = this.performanceMonitor.startOperation(
            "getTopCollections",
            { limit }
        );

        try {
            const batchSize = 20; // Optimal batch size for Reservoir API
            const batches = Math.ceil(limit / batchSize);
            const promises = [];

            for (let i = 0; i < batches; i++) {
                const offset = i * batchSize;
                const currentLimit = Math.min(batchSize, limit - offset);

                promises.push(
                    this.makeRequest<any>(
                        `/collections/v6`,
                        {
                            limit: currentLimit,
                            offset,
                            sortBy: "volume24h",
                        },
                        1
                    )
                );
            }

            const results = await Promise.all(promises);
            const collections = results.flatMap((data) => data.collections);

            const mappedCollections = collections
                .slice(0, limit)
                .map((collection: any) => ({
                    address: collection.id,
                    name: collection.name,
                    symbol: collection.symbol,
                    description: collection.description,
                    imageUrl: collection.image,
                    externalUrl: collection.externalUrl,
                    twitterUsername: collection.twitterUsername,
                    discordUrl: collection.discordUrl,
                    verified:
                        collection.openseaVerificationStatus === "verified",
                    floorPrice: collection.floorAsk?.price?.amount?.native || 0,
                    volume24h: collection.volume24h || 0,
                    marketCap: collection.marketCap || 0,
                    totalSupply: collection.tokenCount || 0,
                    holders: collection.ownerCount || 0,
                    lastUpdate: new Date().toISOString(),
                }));

            endOperation(); // Record successful completion
            return mappedCollections;
        } catch (error) {
            this.performanceMonitor.recordMetric({
                operation: "getTopCollections",
                duration: 0,
                success: false,
                metadata: { error: error.message },
            });

            const nftError = NFTErrorFactory.create(
                ErrorType.API,
                ErrorCode.API_ERROR,
                "Failed to fetch top collections",
                { originalError: error },
                true
            );
            this.errorHandler.handleError(nftError);
            throw error;
        }
    }
}
