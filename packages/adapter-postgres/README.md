# PostgreSQL Adapter for ElizaOS

A robust PostgreSQL adapter for ElizaOS that provides enterprise-grade storage capabilities with support for vector embeddings, dynamic dimension handling, and comprehensive relationship management.

## Features

- Full PostgreSQL compatibility
- Dynamic vector embedding dimensions based on model selection
- Support for multiple embedding providers (OpenAI, Ollama, GAIANET)
- Extensible schema with UUID primary keys
- Advanced vector similarity search capabilities
- Goals and objectives tracking
- Comprehensive logging system
- Built-in fuzzy string matching

## Installation

```bash
pnpm add @elizaos/adapter-postgres
```

## Database Setup

### Prerequisites

The adapter requires the following PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### Environment Variables

```bash
POSTGRES_URI=postgresql://user:password@localhost:5432/database
```

## Schema Overview

### Accounts
```typescript
interface Account {
  id: UUID;
  createdAt: Date;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  details: JSONObject;
}
```

### Memories
```typescript
interface Memory {
  id: UUID;
  type: string;
  createdAt: Date;
  content: JSONObject;
  embedding: Vector;
  userId: UUID;
  agentId: UUID;
  roomId: UUID;
  unique: boolean;
}
```

### Goals
```typescript
interface Goal {
  id: UUID;
  createdAt: Date;
  userId: UUID;
  name: string;
  status: string;
  description: string;
  roomId: UUID;
  objectives: JSONArray;
}
```

## Vector Embedding Support

The adapter automatically handles different embedding dimensions based on the provider:

- OpenAI: 1536 dimensions
- Ollama (mxbai-embed-large): 1024 dimensions
- GAIANET (nomic-embed): 768 dimensions
- Default/BGE: 384 dimensions

Configuration is handled through PostgreSQL settings:

```sql
SET app.use_openai_embedding = 'true';  -- For OpenAI
SET app.use_ollama_embedding = 'true';  -- For Ollama
SET app.use_gaianet_embedding = 'true'; -- For GAIANET
```

## Usage

### Basic Setup

```typescript
import { PostgresAdapter } from '@elizaos/adapter-postgres';

const adapter = new PostgresAdapter({
  connectionString: process.env.POSTGRES_URI
});

await adapter.init();
```

### Working with Memories

```typescript
// Store a memory with embedding
await adapter.createMemory({
  type: 'conversation',
  content: { message: 'Hello world' },
  embedding: vectorData,
  userId: userUUID,
  roomId: roomUUID
});

// Query similar memories
const similar = await adapter.findSimilarMemories(embedding, {
  limit: 10,
  threshold: 0.8
});
```

### Managing Goals

```typescript
// Create a new goal
await adapter.createGoal({
  userId: userUUID,
  name: 'Complete project',
  description: 'Finish all project milestones',
  objectives: ['Research', 'Development', 'Testing'],
  roomId: roomUUID
});

// Update goal status
await adapter.updateGoalStatus(goalUUID, 'IN_PROGRESS');
```

### Logging System

```typescript
// Create a log entry
await adapter.createLog({
  userId: userUUID,
  body: { action: 'user_interaction', details: {...} },
  type: 'system_event',
  roomId: roomUUID
});
```

## Performance Considerations

- Vector operations use optimized PostgreSQL extensions
- UUID primary keys for distributed scalability
- Foreign key constraints with cascade deletion
- JSONB storage for flexible schema evolution
- Built-in timestamp management for auditing
- Unique constraints where appropriate

## Best Practices

1. Use prepared statements for better performance
2. Implement connection pooling for production use
3. Regular maintenance of vector indexes
4. Monitor and vacuum JSONB storage regularly
5. Use appropriate embedding dimensions for your use case

## Requirements

- PostgreSQL 14+
- Node.js 23.3.0+
- PostgreSQL vector extension
- PostgreSQL fuzzystrmatch extension
