import axios from "axios";
import { Service, ServiceType, IAgentRuntime } from "@ai16z/eliza";
import type { CacheManager } from "./cache-manager";
import type { RateLimiter } from "./rate-limiter";

interface MarketIntelligenceConfig {
    cacheManager?: CacheManager;
    rateLimiter?: RateLimiter;
}

interface MarketData {
    floorPrice: number;
    volume24h: number;
    marketCap: number;
    holders: number;
    whaleHolders: number;
    washTradingScore: number;
    liquidityScore: number;
    priceHistory: Array<{
        timestamp: number;
        price: number;
    }>;
}

export class MarketIntelligenceService extends Service {
    private cacheManager?: CacheManager;
    private rateLimiter?: RateLimiter;
    protected runtime?: IAgentRuntime;

    constructor(config?: MarketIntelligenceConfig) {
        super();
        this.cacheManager = config?.cacheManager;
        this.rateLimiter = config?.rateLimiter;
    }

    static override get serviceType(): ServiceType {
        return "nft_market_intelligence" as ServiceType;
    }

    override async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        // Initialize any required resources
    }

    private async makeRequest<T>(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<T> {
        const cacheKey = `market:${endpoint}:${JSON.stringify(params)}`;

        // Check cache first
        if (this.cacheManager) {
            const cached = await this.cacheManager.get<T>(cacheKey);
            if (cached) return cached;
        }

        // Check rate limit
        if (this.rateLimiter) {
            await this.rateLimiter.checkLimit("market");
        }

        try {
            const response = await axios.get(endpoint, { params });

            // Cache the response
            if (this.cacheManager) {
                await this.cacheManager.set(cacheKey, response.data);
            }

            return response.data;
        } catch (error) {
            console.error("Market Intelligence API error:", error);
            throw error;
        }
    }

    async getMarketData(address: string): Promise<MarketData> {
        // Combine data from multiple sources
        const [priceData, holderData, tradingData] = await Promise.all([
            this.getPriceData(address),
            this.getHolderData(address),
            this.getTradingData(address),
        ]);

        return {
            ...priceData,
            ...holderData,
            ...tradingData,
        };
    }

    private async getPriceData(address: string) {
        return this.makeRequest<any>(`/api/price/${address}`);
    }

    private async getHolderData(address: string) {
        return this.makeRequest<any>(`/api/holders/${address}`);
    }

    private async getTradingData(address: string) {
        return this.makeRequest<any>(`/api/trading/${address}`);
    }

    async detectWashTrading(address: string) {
        return this.makeRequest<any>(`/api/wash-trading/${address}`);
    }

    async trackWhaleActivity(address: string) {
        return this.makeRequest<any>(`/api/whale-activity/${address}`);
    }

    async analyzeLiquidity(address: string) {
        return this.makeRequest<any>(`/api/liquidity/${address}`);
    }

    async predictPrices(address: string) {
        return this.makeRequest<any>(`/api/price-prediction/${address}`);
    }

    async getRarityAnalysis(address: string) {
        return this.makeRequest<any>(`/api/rarity/${address}`);
    }

    async getMarketplaceData(address: string) {
        return this.makeRequest<any>(`/api/marketplace/${address}`);
    }
}
