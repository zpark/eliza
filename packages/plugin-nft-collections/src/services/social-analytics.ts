import axios from "axios";
import { Service, ServiceType, IAgentRuntime } from "@ai16z/eliza";
import type { CacheManager } from "./cache-manager";
import type { RateLimiter } from "./rate-limiter";

interface SocialAnalyticsConfig {
    cacheManager?: CacheManager;
    rateLimiter?: RateLimiter;
    apiKeys?: {
        twitter?: string;
        discord?: string;
        telegram?: string;
    };
}

interface SocialData {
    twitter: {
        followers: number;
        engagement: number;
        sentiment: number;
        recentTweets: Array<{
            id: string;
            text: string;
            likes: number;
            retweets: number;
            replies: number;
        }>;
    };
    discord: {
        members: number;
        activeUsers: number;
        messageVolume: number;
        topChannels: Array<{
            name: string;
            messages: number;
            users: number;
        }>;
    };
    telegram?: {
        members: number;
        activeUsers: number;
        messageVolume: number;
    };
    sentiment: {
        overall: number;
        twitter: number;
        discord: number;
        telegram?: number;
    };
}

interface SocialMetrics {
    twitter: {
        followers: number;
        engagement: {
            likes: number;
            retweets: number;
            replies: number;
            mentions: number;
        };
        sentiment: {
            positive: number;
            neutral: number;
            negative: number;
        };
    };
    mentions: Array<{
        platform: string;
        text: string;
        timestamp: Date;
        author: string;
        engagement: number;
    }>;
    influencers: Array<{
        address: string;
        platform: string;
        followers: number;
        engagement: number;
        sentiment: number;
    }>;
    trending: boolean;
}

export class SocialAnalyticsService extends Service {
    private cacheManager?: CacheManager;
    private rateLimiter?: RateLimiter;
    protected runtime?: IAgentRuntime;
    private apiKeys: Required<NonNullable<SocialAnalyticsConfig["apiKeys"]>>;

    constructor(config?: SocialAnalyticsConfig) {
        super();
        this.cacheManager = config?.cacheManager;
        this.rateLimiter = config?.rateLimiter;
        this.apiKeys = {
            twitter: config?.apiKeys?.twitter || "",
            discord: config?.apiKeys?.discord || "",
            telegram: config?.apiKeys?.telegram || "",
        };
    }

    static override get serviceType(): ServiceType {
        return "nft_social_analytics" as ServiceType;
    }

    override async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        // Initialize any required resources
    }

    private async makeRequest<T>(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<T> {
        const cacheKey = `social:${endpoint}:${JSON.stringify(params)}`;

        // Check cache first
        if (this.cacheManager) {
            const cached = await this.cacheManager.get<T>(cacheKey);
            if (cached) return cached;
        }

        // Check rate limit
        if (this.rateLimiter) {
            await this.rateLimiter.checkLimit("social");
        }

        try {
            const response = await axios.get(endpoint, { params });

            // Cache the response
            if (this.cacheManager) {
                await this.cacheManager.set(cacheKey, response.data);
            }

            return response.data;
        } catch (error) {
            console.error("Social Analytics API error:", error);
            throw error;
        }
    }

    async getAnalytics(address: string): Promise<SocialData> {
        // Combine data from multiple sources
        const [twitterData, discordData, telegramData, sentimentData] =
            await Promise.all([
                this.getTwitterData(address),
                this.getDiscordData(address),
                this.getTelegramData(address),
                this.getSentimentData(address),
            ]);

        return {
            twitter: twitterData,
            discord: discordData,
            telegram: telegramData,
            sentiment: sentimentData,
        };
    }

    private async getTwitterData(address: string) {
        return this.makeRequest<any>(`/api/twitter/${address}`);
    }

    private async getDiscordData(address: string) {
        return this.makeRequest<any>(`/api/discord/${address}`);
    }

    private async getTelegramData(address: string) {
        return this.makeRequest<any>(`/api/telegram/${address}`);
    }

    private async getSentimentData(address: string) {
        return this.makeRequest<any>(`/api/sentiment/${address}`);
    }

    async getEngagementMetrics(address: string) {
        return this.makeRequest<any>(`/api/engagement/${address}`);
    }

    async getSentimentAnalysis(address: string) {
        return this.makeRequest<any>(`/api/sentiment-analysis/${address}`);
    }

    async getCommunityGrowth(address: string) {
        return this.makeRequest<any>(`/api/community-growth/${address}`);
    }

    async getInfluencerAnalysis(address: string) {
        return this.makeRequest<any>(`/api/influencers/${address}`);
    }

    async getContentPerformance(address: string) {
        return this.makeRequest<any>(`/api/content/${address}`);
    }

    async getCrossPlatformAnalytics(address: string) {
        return this.makeRequest<any>(`/api/cross-platform/${address}`);
    }

    async getSocialMetrics(address: string): Promise<SocialMetrics> {
        const [twitterData, mentions, influencers] = await Promise.all([
            this.getTwitterData(address),
            this.makeRequest<any>(`/api/mentions/${address}`),
            this.makeRequest<any>(`/api/influencers/${address}`),
        ]);

        return {
            twitter: {
                followers: twitterData.followers,
                engagement: {
                    likes: twitterData.engagement?.likes || 0,
                    retweets: twitterData.engagement?.retweets || 0,
                    replies: twitterData.engagement?.replies || 0,
                    mentions: twitterData.engagement?.mentions || 0,
                },
                sentiment: {
                    positive: twitterData.sentiment?.positive || 0,
                    neutral: twitterData.sentiment?.neutral || 0,
                    negative: twitterData.sentiment?.negative || 0,
                },
            },
            mentions: mentions.map((mention: any) => ({
                platform: mention.platform,
                text: mention.text,
                timestamp: new Date(mention.timestamp),
                author: mention.author,
                engagement: mention.engagement,
            })),
            influencers: influencers.map((influencer: any) => ({
                address: influencer.address,
                platform: influencer.platform,
                followers: influencer.followers,
                engagement: influencer.engagement,
                sentiment: influencer.sentiment,
            })),
            trending: mentions.length > 100 || influencers.length > 10,
        };
    }
}
