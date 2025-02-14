# Supabase Adapter for ElizaOS

A Supabase adapter for ElizaOS that provides cloud-hosted PostgreSQL storage with advanced vector capabilities. This adapter specializes in handling multiple vector embedding dimensions and real-time data management.

## Features

- Multiple vector embedding size support (384, 768, 1024, 1536 dimensions)
- Compatible with various embedding models:
  - OpenAI (1536d)
  - Ollama mxbai-embed-large (1024d)
  - Gaianet nomic-embed (768d)
  - BGE and others (384d)
- Unified memory view across all vector dimensions
- Real-time subscriptions
- Row-level security
- Full-text search
- Type-safe queries with JSONB
- Automatic timestamp management

## Installation

```bash
pnpm add @elizaos/adapter-supabase
```

## Configuration

```typescript
interface SupabaseConfig {
  url: string;
  apiKey: string;
  options?: {
    autoRefreshToken: boolean;
    persistSession: boolean;
    detectSessionInUrl: boolean;
  };
}
```

### Environment Variables

```bash
SUPABASE_URL=your-project-url
SUPABASE_API_KEY=your-api-key
```

## Database Schema

### Vector Tables

The adapter manages multiple tables for different embedding dimensions:

```sql
-- OpenAI embeddings
CREATE TABLE memories_1536 (
  id UUID PRIMARY KEY,
  embedding vector(1536)
  -- common fields
);

-- Ollama embeddings
CREATE TABLE memories_1024 (
  id UUID PRIMARY KEY,
  embedding vector(1024)
  -- common fields
);

-- Gaianet embeddings
CREATE TABLE memories_768 (
  id UUID PRIMARY KEY,
  embedding vector(768)
  -- common fields
);

-- BGE embeddings
CREATE TABLE memories_384 (
  id UUID PRIMARY KEY,
  embedding vector(384)
  -- common fields
);
```

### Unified Memory View

```sql
CREATE VIEW memories AS
  SELECT * FROM memories_1536
  UNION ALL
  SELECT * FROM memories_1024
  UNION ALL
  SELECT * FROM memories_768
  UNION ALL
  SELECT * FROM memories_384;
```

## Usage

### Basic Setup

```typescript
import { SupabaseAdapter } from '@elizaos/adapter-supabase';

const adapter = new SupabaseAdapter({
  url: process.env.SUPABASE_URL,
  apiKey: process.env.SUPABASE_API_KEY
});

await adapter.init();
```

### Storing Memories

```typescript
// The adapter automatically selects the correct table based on embedding dimension
await adapter.createMemory({
  type: 'conversation',
  content: { text: 'Memory content' },
  embedding: new Float32Array(/* your embedding */),
  userId,
  roomId
});
```

### Managing Goals

```typescript
await adapter.createGoal({
  name: 'Project completion',
  status: 'IN_PROGRESS',
  objectives: ['Research', 'Development', 'Testing'],
  userId,
  roomId
});
```

### Real-time Subscriptions

```typescript
adapter.subscribe('memories', (payload) => {
  console.log('Memory updated:', payload);
});
```

## Vector Search

The adapter supports similarity search across all embedding dimensions:

```typescript
// Search for similar memories
const similar = await adapter.findSimilarMemories(embedding, {
  limit: 10,
  threshold: 0.8
});
```

## Performance Optimizations

1. Automatic table selection based on embedding dimension
2. Unified view for simplified queries
3. JSONB for efficient JSON storage
4. Vector indexes for fast similarity search
5. Foreign key constraints with cascade deletion
6. UUID primary keys for distributed systems

## Best Practices

1. Use the correct embedding dimension for your model
2. Implement proper error handling
3. Use transactions for related operations
4. Consider row-level security for multi-tenant applications
5. Monitor real-time subscription usage
6. Implement proper connection pooling

## TypeScript Support

```typescript
interface Memory {
  id: UUID;
  type: string;
  content: JSONObject;
  embedding: Float32Array;
  userId?: UUID;
  roomId?: UUID;
  agentId?: UUID;
  unique: boolean;
}

interface Goal {
  id: UUID;
  name: string;
  status: string;
  description?: string;
  objectives: string[];
  userId: UUID;
  roomId: UUID;
}
```

## Requirements

- Supabase project with PostgreSQL 14+
- Vector extension enabled
- Node.js 23.3.0+
- PostgreSQL vector extension
- ElizaOS core package

## Rate Limits

- Consider Supabase tier limits for:
  - Database connections
  - Real-time connections
  - Database size
  - Row limits
  - API requests
