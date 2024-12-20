# NFT Collections Plugin

A powerful Eliza plugin that provides NFT collection data and interaction capabilities on Ethereum.

## Features

- Get top NFT collections with floor prices and volume metrics
- Fetch floor listings for specific collections
- Execute NFT purchases with multi-step transaction paths
- Smart NFT knowledge evaluation system

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
```

## API Reference

### NFT Service Methods

#### `getTopCollections(options?: { limit?: number })`

Fetches top NFT collections sorted by volume.

```typescript
const collections = await nftService.getTopCollections({ limit: 10 });
```

Returns: `Promise<NFTCollection[]>`

#### `getFloorListings(params: { collection: string, limit: number, sortBy?: "price" | "rarity" })`

Gets floor listings for a specific collection.

```typescript
const listings = await nftService.getFloorListings({
    collection: "0x...",
    limit: 5,
    sortBy: "price",
});
```

Returns: `Promise<NFTListing[]>`

#### `executeBuy(params: { listings: NFTListing[], taker: string, source?: string })`

Executes NFT purchase transactions.

```typescript
const result = await nftService.executeBuy({
  listings: [...],
  taker: "0x..."
});
```

Returns: `Promise<{ path: string, steps: Array<{ id: string, action: string, description: string, status: "complete" | "incomplete" }> }>`

## Types

### NFTCollection

```typescript
interface NFTCollection {
    id: string;
    name: string;
    address: string;
    floorPrice: number;
    volume24h: number;
    imageUrl: string;
    tokenCount: number;
}
```

### NFTListing

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

### NFTKnowledge

```typescript
interface NFTKnowledge {
    mentionsCollection: boolean;
    mentionsFloorPrice: boolean;
    mentionsVolume: boolean;
    mentionsRarity: boolean;
}
```

## Plugin Components

The plugin consists of:

- Actions: `getCollections` and `sweepFloor`
- Providers: `nftCollectionProvider`
- Evaluators: `nftKnowledgeEvaluator`

## License

MIT
