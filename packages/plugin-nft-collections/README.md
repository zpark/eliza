# NFT Collections Plugin

A powerful plugin for interacting with NFT collections, providing comprehensive market data, social analytics, and trading capabilities through various APIs including Reservoir, CoinGecko, and more. While designed to work with any EVM NFT collection, the plugin includes special support for 420+ curated collections featured on ikigailabs.xyz.

## Features

### Core Features (Reservoir Tools API)

- Real-time NFT collection data and market stats
- Floor prices, volume, and market cap tracking
- Collection activity monitoring
- Token-level data and attributes
- Collection statistics and rankings

### Curated Collections Support

- 420+ verified NFT collections featured on ikigailabs.xyz
- Enhanced metadata and social information
- Prioritized data fetching and caching
- Pre-verified contract addresses
- Featured collections highlighting
- Quick lookup and validation functions

### Market Data

- Real-time floor prices and volume tracking
- Market cap and holder statistics
- Price history and trends
- Multi-marketplace activity tracking
- Wash trading detection
- Liquidity analysis
- Whale activity monitoring

### Social Analytics

- Twitter engagement metrics
- Discord community stats
- Telegram group analytics
- Sentiment analysis
- Influencer tracking
- Community growth metrics

### Trading Features

- Floor sweeping with best price routing
    - Buy NFTs at floor price
    - Batch purchase support
    - Multi-marketplace execution
    - Gas optimization
    - Price suggestions
- Listing Management (ikigailabs.xyz)
    - Automatic 2x purchase price listing
    - Manual price override option
    - Purchase history tracking
    - Ownership verification
    - 30-day listing duration

## Installation

```bash
pnpm add @ai16z/plugin-nft-collections
```

## Configuration

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
    reservoir: "your-reservoir-api-key",
    coingecko: "your-coingecko-api-key", // Optional
    social: {
        twitter: "your-twitter-api-key", // Optional
        discord: "your-discord-api-key", // Optional
        telegram: "your-telegram-api-key", // Optional
    },
    market: {
        nansen: "your-nansen-api-key", // Optional
        dune: "your-dune-api-key", // Optional
        alchemy: "your-alchemy-api-key", // Optional
        chainbase: "your-chainbase-api-key", // Optional
        nftscan: "your-nftscan-api-key", // Optional
    }
}
```

## Usage

### Basic Setup

```typescript
import { NFTCollectionsPlugin } from "@ai16z/plugin-nft-collections";

// Initialize the plugin
const plugin = new NFTCollectionsPlugin({
    reservoir: "your-reservoir-api-key",
});

// Register with your agent
agent.registerPlugin(plugin);
```

### Fetching Collection Data

```typescript
// Check if a collection is in our curated list
const isCurated = isCuratedCollection("0x1234...abcd");

// Get metadata for a curated collection
const metadata = getCuratedCollection("0x1234...abcd");

// Get all curated collection addresses
const curatedAddresses = getCuratedAddresses();

// Get featured collection addresses
const featuredAddresses = getFeaturedAddresses();

// Get verified collection addresses
const verifiedAddresses = getVerifiedAddresses();

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

// Get detailed market intelligence
const details =
    await marketIntelligenceService.getMarketIntelligence("0x1234...abcd");
```

### Social Analytics

```typescript
// Get social metrics
const socialMetrics =
    await socialAnalyticsService.getSocialMetrics("0x1234...abcd");

// Get community stats
const communityMetrics =
    await socialAnalyticsService.getCommunityMetrics("0x1234...abcd");

// Get sentiment analysis
const sentiment =
    await socialAnalyticsService.analyzeSentiment("0x1234...abcd");

// Track social performance
const performance =
    await socialAnalyticsService.trackSocialPerformance("0x1234...abcd");
```

### Trading Operations

```typescript
// List an NFT
const listing = await nftService.createListing({
    tokenId: "123",
    collectionAddress: "0x1234...abcd",
    price: 1.5,
    marketplace: "ikigailabs",
});

// Sweep floor
const sweep = await nftService.executeBuy({
    listings: floorListings,
    taker: "0xdef...789",
});

// Cancel listing
const cancelResult = await nftService.cancelListing({
    listingId: "listing-id",
    marketplace: "ikigailabs",
});

// Get owned NFTs
const ownedNFTs = await nftService.getOwnedNFTs(walletAddress);
```

## Response Types

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

## Available Actions

1. `LIST_NFT`: Create a listing on ikigailabs.xyz

    ```typescript
    // Example message
    "List NFT #123 from collection 0x1234...abcd for 1.5 ETH";
    ```

2. `SWEEP_FLOOR`: Sweep floor listings

    ```typescript
    // Example message
    "Sweep 5 NFTs from collection 0x1234...abcd with max price 2 ETH";
    ```

3. `GET_STATS`: Get collection statistics
    ```typescript
    // Example message
    "Show me stats for collection 0x1234...abcd";
    ```

## Market Intelligence Features

- Wash Trading Detection
- Whale Activity Tracking
- Liquidity Analysis
- Price Predictions
- Rarity Analysis
- Multi-marketplace Data Aggregation

## Social Analytics Features

- Engagement Metrics
- Sentiment Analysis
- Community Growth Tracking
- Influencer Analysis
- Content Performance
- Cross-platform Analytics

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

## Development

### Running Tests

```bash
pnpm test
```

### Building

```bash
pnpm build
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For support, please open an issue in the repository or contact the team at support@ai16z.com.
