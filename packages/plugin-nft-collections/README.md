# NFT Collections Plugin

A comprehensive NFT collections plugin powered by Reservoir Tools API, with optional integrations for enhanced market intelligence and social analytics.

## Features

### Core Features (Reservoir Tools API)

- Real-time NFT collection data and market stats
- Floor prices, volume, and market cap tracking
- Collection activity monitoring
- Token-level data and attributes
- Collection statistics and rankings

### Optional Enhancements

- Market Intelligence (requires additional API keys)

    - Wash trading detection
    - Whale activity tracking
    - Liquidity analysis
    - Multi-marketplace activity tracking
    - Price history and trends

- Social Analytics (requires additional API keys)
    - Twitter metrics and engagement
    - Discord community stats
    - Telegram group analytics
    - Social sentiment analysis
    - Community growth tracking

## Setup

### Required Configuration

```typescript
{
  "secrets": {
    "RESERVOIR_API_KEY": "your-reservoir-api-key" // Required
  }
}
```

### Optional API Keys

```typescript
{
  "secrets": {
    // Market Intelligence
    "NANSEN_API_KEY": "your-nansen-api-key",
    "DUNE_API_KEY": "your-dune-api-key",
    "ALCHEMY_API_KEY": "your-alchemy-api-key",
    "CHAINBASE_API_KEY": "your-chainbase-api-key",
    "NFTSCAN_API_KEY": "your-nftscan-api-key",

    // Social Analytics
    "TWITTER_API_KEY": "your-twitter-api-key",
    "DISCORD_API_KEY": "your-discord-api-key",
    "TELEGRAM_API_KEY": "your-telegram-api-key"
  }
}
```

## Usage

### Basic Usage

```typescript
import { NFTCollectionsPlugin } from "@ai16z/plugin-nft-collections";

// Initialize the plugin with required Reservoir API key
const plugin = new NFTCollectionsPlugin();
await plugin.setup(character);
```

### Data Access

```typescript
// Get top collections
const collections = await nftService.getTopCollections();

// Get market stats
const stats = await nftService.getMarketStats();

// Get collection activity
const activity = await nftService.getCollectionActivity(collectionAddress);

// Get collection tokens
const tokens = await nftService.getCollectionTokens(collectionAddress);

// Get collection attributes
const attributes = await nftService.getCollectionAttributes(collectionAddress);
```

### Enhanced Features (when available)

#### Market Intelligence

```typescript
// Get market intelligence data
const intelligence =
    await marketIntelligenceService.getMarketIntelligence(collectionAddress);

// Detect wash trading
const washTrading =
    await marketIntelligenceService.detectWashTrading(collectionAddress);

// Get whale activity
const whales =
    await marketIntelligenceService.getWhaleActivity(collectionAddress);

// Get liquidity analysis
const liquidity =
    await marketIntelligenceService.getLiquidityAnalysis(collectionAddress);
```

#### Social Analytics

```typescript
// Get social metrics
const social = await socialAnalyticsService.getSocialMetrics(collectionAddress);

// Get community metrics
const community =
    await socialAnalyticsService.getCommunityMetrics(collectionAddress);

// Get sentiment analysis
const sentiment =
    await socialAnalyticsService.analyzeSentiment(collectionAddress);

// Track social performance
const performance =
    await socialAnalyticsService.trackSocialPerformance(collectionAddress);
```

## API Response Types

### Core Types

```typescript
interface NFTCollection {
    address: string;
    name: string;
    symbol: string;
    description?: string;
    imageUrl?: string;
    floorPrice: number;
    volume24h: number;
    marketCap: number;
    holders: number;
}

interface MarketStats {
    totalVolume24h: number;
    totalMarketCap: number;
    totalCollections: number;
    totalHolders: number;
    averageFloorPrice: number;
}
```

### Market Intelligence Types

```typescript
interface MarketIntelligence {
    priceHistory: Array<{
        timestamp: number;
        price: number;
        volume: number;
    }>;
    washTradingMetrics: {
        suspiciousVolume24h: number;
        suspiciousTransactions24h: number;
        washTradingScore: number;
    };
    marketplaceActivity: {
        [marketplace: string]: {
            volume24h: number;
            trades24h: number;
            marketShare: number;
        };
    };
    whaleActivity: Array<{
        address: string;
        type: "buy" | "sell";
        amount: number;
        timestamp: number;
    }>;
    liquidityMetrics: {
        depth: Array<{
            price: number;
            quantity: number;
        }>;
        bidAskSpread: number;
        bestBid: number;
        bestAsk: number;
    };
}
```

### Social Analytics Types

```typescript
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
        content: string;
        author: string;
        timestamp: number;
        reach: number;
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

interface CommunityMetrics {
    discord: {
        members: number;
        activity: {
            messagesPerDay: number;
            activeUsers: number;
            growthRate: number;
        };
        channels: Array<{
            name: string;
            members: number;
            activity: number;
        }>;
    } | null;
    telegram: {
        members: number;
        activity: {
            messagesPerDay: number;
            activeUsers: number;
            growthRate: number;
        };
    } | null;
    totalMembers: number;
    growthRate: number;
    engagement: {
        activeUsers: number;
        messagesPerDay: number;
        topChannels: Array<{
            platform: string;
            name: string;
            activity: number;
        }>;
    };
}
```

## Error Handling

The plugin includes robust error handling for both required and optional services:

- Required Reservoir API errors are thrown and must be handled by the application
- Optional service errors are caught and logged, allowing the application to continue with reduced functionality
- Network errors and API rate limits are handled gracefully
- Invalid API keys trigger clear error messages during setup

## Rate Limits

- Reservoir API: Refer to [Reservoir API docs](https://docs.reservoir.tools/reference/rate-limits) for current limits
- Optional APIs: Refer to respective API documentation for rate limits
- Implement appropriate caching strategies for high-traffic applications

## Best Practices

1. Always provide the Reservoir API key during setup
2. Implement appropriate error handling for required services
3. Use optional services only when needed to minimize API calls
4. Cache frequently accessed data when appropriate
5. Monitor API usage to stay within rate limits
6. Keep API keys secure and never expose them in client-side code
