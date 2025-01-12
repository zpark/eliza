import { Service } from "@elizaos/core";
import { IAgentRuntime } from "@elizaos/core";

import { ReservoirService } from "./reservoir";
import { MarketIntelligenceService } from "./market-intelligence";
import { SocialAnalyticsService } from "./social-analytics";
import { MemoryCacheManager } from "./cache-manager";
import { RateLimiter } from "./rate-limiter";
import { nftCollectionProvider } from "../providers/nft-collections";
import { Memory } from "@elizaos/core";

interface Config {
    caching?: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
    };
    security?: {
        rateLimit?: {
            enabled: boolean;
            maxRequests: number;
            windowMs: number;
        };
    };
    maxConcurrent: number;
    maxRetries: number;
    batchSize: number;
}

export class NFTCollectionsService extends Service {
    // static serviceType: ServiceType = "nft_collections";

    private reservoirService?: ReservoirService;
    private marketIntelligenceService?: MarketIntelligenceService;
    private socialAnalyticsService?: SocialAnalyticsService;
    private cacheManager?: MemoryCacheManager;
    private rateLimiter?: RateLimiter;
    private runtime: IAgentRuntime | null = null;
    private config: Config;

    async initialize(runtime: IAgentRuntime): Promise<void> {
        console.log("Initializing NFTCollectionsService");

        // Consider exposing these settings as environment variables to allow users to provide custom configuration values.
        this.config = {
            caching: {
                enabled: true,
                ttl: 3600000, // 1 hour
                maxSize: 1000,
            },
            security: {
                rateLimit: {
                    enabled: true,
                    maxRequests: 100,
                    windowMs: 60000,
                },
            },
            maxConcurrent: 5, // Maximum concurrent requests
            maxRetries: 3, // Maximum retry attempts
            batchSize: 20, // Batch size for collection requests
        };

        this.runtime = runtime;
        this.initializeServices();
    }

    async initializeServices(): Promise<void> {
        if (!this.runtime) {
            throw new Error("Runtime not available in character");
        }

        const reservoirApiKey = this.runtime.getSetting("RESERVOIR_API_KEY");

        if (!reservoirApiKey) {
            throw new Error("RESERVOIR_API_KEY is required");
        }

        // Initialize caching if enabled
        if (this.config.caching?.enabled) {
            this.cacheManager = new MemoryCacheManager({
                ttl: this.config.caching.ttl,
                maxSize: this.config.caching.maxSize,
            });
        }

        // Initialize rate limiter if enabled
        if (this.config.security?.rateLimit?.enabled) {
            this.rateLimiter = new RateLimiter({
                maxRequests: this.config.security.rateLimit.maxRequests,
                windowMs: this.config.security.rateLimit.windowMs,
            });
        }

        // Initialize Reservoir service with enhanced configuration
        this.reservoirService = new ReservoirService(reservoirApiKey, {
            cacheManager: this.cacheManager,
            rateLimiter: this.rateLimiter,
            maxConcurrent: this.config.maxConcurrent,
            maxRetries: this.config.maxRetries,
            batchSize: this.config.batchSize,
        });
        await this.reservoirService.initialize(this.runtime);
        await this.runtime.registerService(this.reservoirService);

        // Initialize optional services with enhanced configuration
        const marketApiKeys = {
            nansen: this.runtime.getSetting("NANSEN_API_KEY"),
            dune: this.runtime.getSetting("DUNE_API_KEY"),
            alchemy: this.runtime.getSetting("ALCHEMY_API_KEY"),
            chainbase: this.runtime.getSetting("CHAINBASE_API_KEY"),
            nftscan: this.runtime.getSetting("NFTSCAN_API_KEY"),
        };

        if (Object.values(marketApiKeys).some((key) => key)) {
            this.marketIntelligenceService = new MarketIntelligenceService({
                cacheManager: this.cacheManager,
                rateLimiter: this.rateLimiter,
            });
            await this.marketIntelligenceService.initialize(this.runtime);
            await this.runtime.registerService(this.marketIntelligenceService);
        }

        const socialApiKeys = {
            twitter: this.runtime.getSetting("TWITTER_API_KEY"),
            discord: this.runtime.getSetting("DISCORD_API_KEY"),
            telegram: this.runtime.getSetting("TELEGRAM_API_KEY"),
        };

        if (Object.values(socialApiKeys).some((key) => key)) {
            this.socialAnalyticsService = new SocialAnalyticsService({
                cacheManager: this.cacheManager,
                rateLimiter: this.rateLimiter,
            });
            await this.socialAnalyticsService.initialize(this.runtime);
            await this.runtime.registerService(this.socialAnalyticsService);
        }
    }

    async getNFTCollections(runtime: IAgentRuntime, message: Memory) {
        return await nftCollectionProvider.get(runtime, message);
    }

    async teardown(): Promise<void> {
        // Cleanup resources
        if (this.cacheManager) {
            await this.cacheManager.clear();
        }
        if (this.rateLimiter) {
            await this.rateLimiter.cleanup();
        }
    }
}

export default NFTCollectionsService;
