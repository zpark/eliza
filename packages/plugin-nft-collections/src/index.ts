import {
    Plugin,
    type Character,
    type Service,
    type IAgentRuntime,
} from "@ai16z/eliza";
import { ReservoirService } from "./services/reservoir";
import { MarketIntelligenceService } from "./services/market-intelligence";
import { SocialAnalyticsService } from "./services/social-analytics";
import { MemoryCacheManager } from "./services/cache-manager";
import { RateLimiter } from "./services/rate-limiter";
import { SecurityManager } from "./services/security-manager";
import { nftCollectionProvider } from "./providers/nft-collections";
import { sweepFloorAction } from "./actions/sweep-floor";
import { listNFTAction } from "./actions/list-nft";

interface NFTCollectionsPluginConfig {
    caching?: {
        enabled: boolean;
        ttl?: number;
        maxSize?: number;
    };
    security?: {
        rateLimit?: {
            enabled: boolean;
            maxRequests?: number;
            windowMs?: number;
        };
    };
    maxConcurrent?: number;
    maxRetries?: number;
    batchSize?: number;
}

interface ExtendedCharacter extends Character {
    providers?: any[];
    actions?: any[];
    runtime?: IAgentRuntime;
}

export class NFTCollectionsPlugin implements Plugin {
    public readonly name = "nft-collections";
    public readonly description =
        "Provides NFT collection information and market intelligence";

    private reservoirService?: ReservoirService;
    private marketIntelligenceService?: MarketIntelligenceService;
    private socialAnalyticsService?: SocialAnalyticsService;
    private cacheManager?: MemoryCacheManager;
    private rateLimiter?: RateLimiter;
    private securityManager?: SecurityManager;

    constructor(private config: NFTCollectionsPluginConfig = {}) {
        this.initializeServices();
    }

    private initializeServices(): void {
        // Initialize caching if enabled
        if (this.config.caching?.enabled) {
            this.cacheManager = new MemoryCacheManager(
                this.config.caching.ttl || 3600000 // 1 hour default
            );
        }

        // Initialize rate limiter if enabled
        if (this.config.security?.rateLimit?.enabled) {
            this.rateLimiter = new RateLimiter({
                maxRequests: this.config.security.rateLimit.maxRequests || 100,
                windowMs: this.config.security.rateLimit.windowMs || 60000,
            });
        }
    }

    async setup(character: ExtendedCharacter): Promise<void> {
        if (!character.runtime) {
            throw new Error("Runtime not available in character");
        }

        const reservoirApiKey =
            character.settings?.secrets?.RESERVOIR_API_KEY ||
            process.env.RESERVOIR_API_KEY;

        if (!reservoirApiKey) {
            throw new Error("RESERVOIR_API_KEY is required");
        }

        // Initialize Reservoir service with enhanced configuration
        this.reservoirService = new ReservoirService(reservoirApiKey, {
            cacheManager: this.cacheManager,
            rateLimiter: this.rateLimiter,
            maxConcurrent: this.config.maxConcurrent,
            maxRetries: this.config.maxRetries,
            batchSize: this.config.batchSize,
        });
        await this.reservoirService.initialize(character.runtime);
        await character.runtime.registerService(this.reservoirService);

        // Initialize optional services with enhanced configuration
        const marketApiKeys = {
            nansen: character.settings.secrets?.NANSEN_API_KEY,
            dune: character.settings.secrets?.DUNE_API_KEY,
            alchemy: character.settings.secrets?.ALCHEMY_API_KEY,
            chainbase: character.settings.secrets?.CHAINBASE_API_KEY,
            nftscan: character.settings.secrets?.NFTSCAN_API_KEY,
        };

        if (Object.values(marketApiKeys).some((key) => key)) {
            this.marketIntelligenceService = new MarketIntelligenceService({
                cacheManager: this.cacheManager,
                rateLimiter: this.rateLimiter,
            });
            await this.marketIntelligenceService.initialize(character.runtime);
            await character.runtime.registerService(
                this.marketIntelligenceService
            );
        }

        const socialApiKeys = {
            twitter: character.settings.secrets?.TWITTER_API_KEY,
            discord: character.settings.secrets?.DISCORD_API_KEY,
            telegram: character.settings.secrets?.TELEGRAM_API_KEY,
        };

        if (Object.values(socialApiKeys).some((key) => key)) {
            this.socialAnalyticsService = new SocialAnalyticsService({
                cacheManager: this.cacheManager,
                rateLimiter: this.rateLimiter,
            });
            await this.socialAnalyticsService.initialize(character.runtime);
            await character.runtime.registerService(
                this.socialAnalyticsService
            );
        }

        // Register providers and actions
        character.providers = character.providers || [];
        character.providers.push(nftCollectionProvider);

        character.actions = character.actions || [];
        character.actions.push(sweepFloorAction, listNFTAction);
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

export const nftCollectionsPlugin = new NFTCollectionsPlugin();

export { ReservoirService } from "./services/reservoir";
export { MarketIntelligenceService } from "./services/market-intelligence";
export { SocialAnalyticsService } from "./services/social-analytics";
export * from "./types";

export default nftCollectionsPlugin;
