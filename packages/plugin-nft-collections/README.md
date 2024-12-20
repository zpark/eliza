# NFT Collections Plugin

A powerful Eliza plugin that provides deep insights into NFT collections, combining on-chain analytics, market data, artist information, and social metrics.

## Features

### Collection Data

- Comprehensive collection metadata and statistics
- Artist profiles and background information
- Real-time floor prices and volume metrics
- Social media engagement tracking
- Contract verification and standards

### On-Chain Analytics

- Holder distribution analysis
- Whale tracking and monitoring
- Trading volume and patterns
- Liquidity depth analysis
- Trait distribution and rarity scores

### Market Intelligence

- Price history and trends
- Wash trading detection
- Multi-marketplace activity tracking
- Market sentiment analysis
- Top gainers and losers tracking

### News & Social

- Curated collection news feed
- Sentiment analysis on news
- Community engagement metrics
- Social media performance tracking

## Installation

```bash
npm install @ai16z/plugin-nft-collections
```

## Usage

```typescript
import nftCollectionPlugin from "@ai16z/plugin-nft-collections";
import { Eliza } from "@ai16z/eliza";

// Initialize Eliza with the plugin
const eliza = new Eliza({
    plugins: [nftCollectionPlugin],
});

// Access NFT services
const nftService = eliza.services.nft;

// Get collection data with all analytics
const collection = await nftService.getTopCollections({ limit: 1 });
const analytics = await nftService.getCollectionAnalytics(
    collection[0].address
);
const news = await nftService.getCollectionNews(collection[0].address, {
    limit: 10,
    minRelevance: 0.8,
});
```

## API Reference

### Collection Methods

#### `getTopCollections(options?: { limit?: number })`

Fetches top NFT collections with comprehensive data.

Returns: `Promise<NFTCollection[]>`

```typescript
interface NFTCollection {
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
```

#### `getCollectionAnalytics(address: string)`

Fetches detailed on-chain analytics for a collection.

Returns: `Promise<OnChainAnalytics>`

```typescript
interface OnChainAnalytics {
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
```

#### `getMarketActivity(address: string, options?: { timeframe?: "24h" | "7d" | "30d", excludeWashTrading?: boolean })`

Fetches market activity with optional wash trading filtering.

Returns: `Promise<MarketActivity>`

```typescript
interface MarketActivity {
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
```

#### `getCollectionNews(address: string, options?: { limit?: number; minRelevance?: number })`

Fetches curated news for a collection with relevance filtering.

Returns: `Promise<CollectionNews[]>`

```typescript
interface CollectionNews {
    id: string;
    title: string;
    source: string;
    url: string;
    timestamp: number;
    sentiment: "positive" | "negative" | "neutral";
    relevanceScore: number;
}
```

#### `getArtistInfo(artistId: string)`

Fetches detailed artist information.

Returns: `Promise<NFTArtist>`

```typescript
interface NFTArtist {
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
```

### Market Methods

#### `getMarketStats()`

Fetches overall NFT market statistics.

Returns: `Promise<NFTMarketStats>`

```typescript
interface NFTMarketStats {
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
```

#### `getFloorListings(params: { collection: string; limit: number; sortBy?: "price" | "rarity" })`

Fetches floor listings with optional sorting.

Returns: `Promise<NFTListing[]>`

```typescript
interface NFTListing {
    id: string;
    tokenId: string;
    price: number;
    source: string;
    validFrom: number;
    validUntil: number;
}
```

### Trading Methods

#### `executeBuy(params: { listings: NFTListing[]; taker: string; source?: string })`

Executes NFT purchase transactions.

Returns: `Promise<{ path: string; steps: Array<{ id: string; action: string; description: string; status: "complete" | "incomplete" }> }>`

## Plugin Components

The plugin consists of:

- **Actions**: `getCollections` and `sweepFloor` for collection data and trading
- **Providers**: `nftCollectionProvider` for data aggregation
- **Evaluators**: `nftKnowledgeEvaluator` for context-aware responses

## Best Practices

1. **Data Freshness**

    - Always check timestamps on market data
    - Use real-time floor prices for trading
    - Consider wash trading scores for volume analysis

2. **Analytics Usage**

    - Filter out wash trading for accurate market analysis
    - Use relevance scores for news filtering
    - Consider holding periods for whale analysis

3. **Performance**
    - Cache collection metadata when possible
    - Stream large datasets for trait analysis
    - Batch on-chain queries for efficiency

## License

MIT
