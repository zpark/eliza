# PGLite Adapter for ElizaOS

A lightweight PostgreSQL adapter for ElizaOS built on top of @electric-sql/pglite. This adapter provides persistent storage capabilities with support for vector embeddings, relationship management, and caching.

## Features

- Lightweight PostgreSQL implementation
- Vector embeddings support with HNSW indexing
- Relationship and participant management
- JSON storage capabilities
- Built-in caching system
- Automatic schema creation and migration

## Installation

```bash
pnpm add @elizaos/adapter-pglite
```

## Database Schema

The adapter manages the following tables:

- `memories`: Stores conversation memories with vector embeddings
- `participants`: Manages room participants and their states
- `relationships`: Handles user relationships and statuses
- `cache`: Provides agent-specific caching functionality

### Key Features of Schema

- UUID primary keys with automatic generation
- Timestamped records
- Foreign key constraints with cascade deletion
- HNSW indexing for vector embeddings
- Optimized indexes for common queries

## Usage

### Basic Setup

```typescript
import { PGLiteAdapter } from '@elizaos/adapter-pglite';

const adapter = new PGLiteAdapter({
  // Configuration options
});

// Initialize the database
await adapter.init();
```

### Working with Memories

```typescript
// Store a memory
await adapter.createMemory({
  userId: userUUID,
  roomId: roomUUID,
  body: { content: "Memory content" },
  type: "conversation"
});
```

### Managing Participants

```typescript
// Add participant to room
await adapter.addParticipant({
  userId: userUUID,
  roomId: roomUUID,
  userState: "active"
});

// Update participant state
await adapter.updateParticipantState(participantId, "inactive");
```

### Relationship Management

```typescript
// Create relationship between users
await adapter.createRelationship({
  userA: userAUUID,
  userB: userBUUID,
  status: "following",
  userId: initiatorUUID
});
```

### Caching

```typescript
// Store cache entry
await adapter.setCache({
  key: "cache_key",
  agentId: "agent_id",
  value: { data: "cached_data" },
  expiresAt: new Date(Date.now() + 3600000) // 1 hour expiration
});
```

## Configuration Options

```typescript
interface PGLiteConfig {
  // Database configuration options will go here
  // To be documented based on implementation
}
```

## Performance Considerations

- HNSW index on memories table optimizes vector similarity searches
- Composite indexes on frequently queried columns
- Cascade deletions for referential integrity
- JSON storage for flexible data structures

## Dependencies

- @electric-sql/pglite: ^0.2.15
- @elizaos/core: (workspace dependency)
- whatwg-url: 7.1.0 (peer dependency)

## Requirements

- Node.js 23.3.0 or higher
- Modern browser environment for client-side usage
