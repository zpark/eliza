# NFT Collections Plugin

A comprehensive NFT collections plugin powered by Reservoir Tools API, with optional integrations for enhanced market intelligence and social analytics. Features automated NFT trading capabilities with ikigailabs.xyz integration.

## Features

### Core Features (Reservoir Tools API)

- Real-time NFT collection data and market stats
- Floor prices, volume, and market cap tracking
- Collection activity monitoring
- Token-level data and attributes
- Collection statistics and rankings

### Trading Features

- Automated Floor Sweeping

    - Buy NFTs at floor price
    - Batch purchase support
    - Multi-marketplace execution

- Automated Listing (ikigailabs.xyz)
    - Automatic 2x purchase price listing
    - Manual price override option
    - Purchase history tracking
    - Ownership verification
    - 30-day listing duration

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

### Trading Commands

#### Sweep Floor

```
// Buy NFTs at floor price
"Sweep 5 NFTs from collection 0x1234...abcd at floor price"
```

#### List NFT

```
// Automatic listing at 2x purchase price
"List token #123 from collection 0x1234...abcd"

// Manual price override
"List token #123 from collection 0x1234...abcd for 5 ETH"
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

### Trading Methods

```typescript
// Sweep floor
const buyResult = await nftService.executeBuy({
    listings: floorListings,
    taker: walletAddress,
});

// List NFT
const listingResult = await nftService.createListing({
    tokenId: "123",
    collectionAddress: "0x...",
    price: 2.5,
    marketplace: "ikigailabs",
});

// Cancel listing
const cancelResult = await nftService.cancelListing({
    listingId: "listing-id",
    marketplace: "ikigailabs",
});

// Get owned NFTs
const ownedNFTs = await nftService.getOwnedNFTs(walletAddress);
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

## Trading Response Types

### Buy Response

```typescript
interface BuyResponse {
    path: string;
    steps: Array<{
        action: string;
        status: string;
    }>;
}
```

### Listing Response

```typescript
interface ListingResponse {
    listingId: string;
    status: string;
    transactionHash?: string;
    marketplaceUrl: string;
}
```

### NFT Ownership

```typescript
interface OwnedNFT {
    tokenId: string;
    collectionAddress: string;
    name: string;
    imageUrl?: string;
    attributes?: Record<string, string>;
}
```

## Error Handling

The plugin includes robust error handling for both required and optional services:

- Required Reservoir API errors are thrown and must be handled by the application
- Optional service errors are caught and logged, allowing the application to continue with reduced functionality
- Network errors and API rate limits are handled gracefully
- Invalid API keys trigger clear error messages during setup
- Trading errors include detailed messages for:
    - Ownership verification failures
    - Missing purchase history
    - Price determination issues
    - Transaction failures

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
7. Verify NFT ownership before attempting to list
8. Handle transaction failures gracefully
9. Monitor listing status and expiration
10. Implement proper gas price management for transactions
