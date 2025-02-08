# SQL.js Adapter for ElizaOS

A browser-compatible SQLite adapter for ElizaOS using SQL.js. This adapter provides full SQLite functionality in browser environments, with support for complex queries, JSON storage, and binary data handling.

## Features

- Browser-compatible SQLite implementation
- Full SQL query support
- JSON validation and storage
- Binary data (BLOB) handling
- Statement iteration capabilities
- Comprehensive indexing
- Typed query results
- Knowledge base management

## Installation

```bash
pnpm add @elizaos/adapter-sqljs
```

## Database Schema

### Core Tables

#### Knowledge Base
```sql
CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  agentId TEXT,
  content TEXT NOT NULL,  -- JSON validated
  embedding BLOB,
  createdAt TIMESTAMP,
  isMain INTEGER,
  originalId TEXT,
  chunkIndex INTEGER,
  isShared INTEGER,
  FOREIGN KEY (agentId) REFERENCES accounts(id),
  FOREIGN KEY (originalId) REFERENCES knowledge(id)
);
```

### Supporting Tables

- `accounts`: User and agent information
- `rooms`: Conversation spaces
- `participants`: Room participation tracking
- `relationships`: User connections
- `cache`: Temporary data storage
- `logs`: System event tracking

## Usage

### Basic Setup

```typescript
import { SqlJsAdapter } from '@elizaos/adapter-sqljs';

const adapter = new SqlJsAdapter();
await adapter.init();
```

### Executing Queries

```typescript
// Using typed parameters
interface QueryParams {
  userId: string;
  content: string;
}

const statement = adapter.prepare<QueryParams>(
  'INSERT INTO logs (userId, content) VALUES ($userId, $content)'
);

statement.bind({
  userId: 'user123',
  content: JSON.stringify({ message: 'Hello' })
});
```

### Working with Results

```typescript
// Fetch query results with type safety
interface LogResult {
  id: string;
  content: string;
  createdAt: string;
}

const results = statement.get() as LogResult;
```

### Statement Iteration

```typescript
// Process multiple statements
const iterator = adapter.iterateStatements(sqlScript);

for (const statement of iterator) {
  const remainingSQL = statement.getRemainingSQL();
  // Process statement
}
```

## Special Features

### JSON Validation
- Automatic validation for JSON columns
- CHECK constraints ensure data integrity
- Indexed JSON content for efficient queries

### Binary Data Handling
```typescript
// Store binary data
const statement = adapter.prepare(
  'INSERT INTO knowledge (embedding) VALUES (?)'
);
statement.bind([new Uint8Array([1, 2, 3])]);
```

### Indexed Knowledge Base
- Full-text search on knowledge content
- Agent-specific knowledge filtering
- Shared knowledge management
- Chunk-based document storage

## Performance Optimizations

### Indexes
```sql
CREATE INDEX knowledge_agent_key ON knowledge (agentId);
CREATE INDEX knowledge_content_key ON knowledge 
  ((json_extract(content, '$.text')));
CREATE INDEX knowledge_created_key ON knowledge (agentId, createdAt);
```

### Best Practices

1. Use prepared statements for repeated queries
2. Leverage JSON indexes for content searches
3. Implement proper error handling
4. Use transactions for multiple operations
5. Clean up statements after use
6. Handle memory management in browser environments

## Type System

```typescript
// Core types
type SqlValue = number | string | Uint8Array | null;
type ParamsObject = Record<string, SqlValue>;

// Statement handling
interface Statement {
  bind(params: BindParams): void;
  get(): QueryExecResult;
  free(): void;
}

// Query results
interface QueryExecResult {
  columns: string[];
  values: SqlValue[][];
}
```

## Development Tips

### Working with JSON
```typescript
// Storing JSON data
const data = {
  text: 'content',
  metadata: { type: 'note' }
};

await adapter.exec(`
  INSERT INTO knowledge (content)
  VALUES (json('${JSON.stringify(data)}'))
`);
```

### Error Handling
```typescript
try {
  const statement = adapter.prepare(query);
  // Use statement
} catch (error) {
  console.error('SQL error:', error);
} finally {
  statement?.free();
}
```

## Requirements

- Modern browser environment
- WebAssembly support
- Sufficient memory for in-browser database
- ElizaOS core package
