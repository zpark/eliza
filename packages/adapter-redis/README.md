# Redis Adapter for ElizaOS

A lightweight Redis adapter for ElizaOS that provides caching capabilities with agent-specific namespacing. Built on top of ioredis, it offers reliable caching operations with proper error handling and connection management.

## Features

- Agent-specific cache namespacing
- Connection monitoring and auto-reconnection
- Simple key-value operations
- Robust error handling
- TypeScript support
- Comprehensive test coverage

## Installation

```bash
pnpm add @elizaos/adapter-redis
```

### Dependencies

- ioredis: ^5.4.2
- @elizaos/core: workspace dependency
- whatwg-url: 7.1.0 (peer dependency)

## Usage

### Basic Setup

```typescript
import { RedisClient } from '@elizaos/adapter-redis';

const client = new RedisClient('redis://localhost:6379');
```

### Cache Operations

#### Setting Cache Values

```typescript
const success = await client.setCache({
  agentId: 'agent-uuid',
  key: 'cache-key',
  value: 'cached-value'
});

if (success) {
  console.log('Cache set successfully');
}
```

#### Getting Cache Values

```typescript
const value = await client.getCache({
  agentId: 'agent-uuid',
  key: 'cache-key'
});

if (value) {
  console.log('Retrieved value:', value);
}
```

#### Deleting Cache Values

```typescript
const deleted = await client.deleteCache({
  agentId: 'agent-uuid',
  key: 'cache-key'
});

if (deleted) {
  console.log('Cache entry deleted successfully');
}
```

### Connection Management

```typescript
// The client automatically connects on instantiation
// To disconnect:
await client.disconnect();
```

## Key Features

### Agent-Specific Namespacing

The adapter automatically namespaces all cache keys by agent ID to prevent conflicts:

```typescript
// Internal key format:
`${agentId}:${key}`
```

### Error Handling

- All operations include try-catch blocks
- Failed operations return `false` or `undefined` rather than throwing
- Errors are logged through ElizaOS logger

### Connection Events

The adapter monitors connection status and logs:
- Successful connections
- Connection errors
- Disconnection events

## API Reference

### Constructor

```typescript
constructor(redisUrl: string)
```

### Methods

#### getCache

```typescript
getCache(params: {
  agentId: UUID;
  key: string;
}): Promise<string | undefined>
```

#### setCache

```typescript
setCache(params: {
  agentId: UUID;
  key: string;
  value: string;
}): Promise<boolean>
```

#### deleteCache

```typescript
deleteCache(params: {
  agentId: UUID;
  key: string;
}): Promise<boolean>
```

#### disconnect

```typescript
disconnect(): Promise<void>
```

## Testing

The adapter includes comprehensive tests using Vitest. Run tests with:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Best Practices

1. Always handle the boolean return values from set/delete operations
2. Check for undefined returns from get operations
3. Implement proper error handling in your application
4. Call disconnect when shutting down your application
5. Use meaningful cache keys within your agent namespace

## Requirements

- Node.js 23.3.0+
- Redis server (tested with Redis 6+)
- ElizaOS core package
