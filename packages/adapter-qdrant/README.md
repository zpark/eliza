# Qdrant Adapter for ElizaOS

A vector database adapter for ElizaOS that provides efficient storage and retrieval of vector embeddings using Qdrant. This adapter is optimized for RAG (Retrieval-Augmented Generation) applications with support for metadata, shared knowledge, and sophisticated text preprocessing.

## Features

- Vector similarity search using Qdrant
- Automatic collection initialization
- Sophisticated text preprocessing pipeline
- Support for shared and agent-specific knowledge
- Metadata management
- Cosine similarity distance metric
- Flexible knowledge retrieval options
- Built-in content chunking support

## Installation

```bash
pnpm add @elizaos/adapter-qdrant
```

## Configuration

```typescript
interface QdrantConfig {
  url: string;
  apiKey: string;
  port: number;
  vectorSize: number;
  collectionName: string;
}
```

### Environment Variables

```bash
QDRANT_URL=http://localhost
QDRANT_API_KEY=your_api_key
QDRANT_PORT=6333
```

## Usage

### Basic Setup

```typescript
import { QdrantAdapter } from '@elizaos/adapter-qdrant';

const adapter = new QdrantAdapter({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  port: parseInt(process.env.QDRANT_PORT),
  vectorSize: 1536, // Adjust based on your embedding model
  collectionName: 'your_collection'
});

// Initialize the collection
await adapter.init();
```

### Storing Knowledge

```typescript
// Store a knowledge item
await adapter.createKnowledge({
  id: 'unique-uuid',
  agentId: 'agent-uuid',
  content: {
    text: 'Knowledge content',
    metadata: {
      isShared: false,
      isMain: true,
      chunkIndex: 0
    }
  },
  embedding: Float32Array.from([/* your vector embedding */]),
  createdAt: Date.now()
});
```

### Retrieving Knowledge

```typescript
// Get knowledge by ID
const knowledge = await adapter.getKnowledge({
  id: 'knowledge-uuid'
});

// Search knowledge with parameters
const results = await adapter.getKnowledge({
  query: 'search query',
  limit: 10,
  agentId: 'agent-uuid'
});
```

## Text Preprocessing

The adapter includes a sophisticated preprocessing pipeline that handles:

- Code block removal
- Markdown formatting
- URL normalization
- Mention cleaning
- HTML tag removal
- Comment removal
- Whitespace normalization
- Special character handling

```typescript
// Preprocessing is automatically applied to text content
const processedText = adapter.preprocess(rawText);
```

## Knowledge Structure

```typescript
interface RAGKnowledgeItem {
  id: UUID;
  agentId: UUID;
  content: {
    text: string;
    metadata: {
      isShared?: boolean;
      isMain?: boolean;
      originalId?: string;
      chunkIndex?: number;
      [key: string]: unknown;
    };
  };
  embedding?: Float32Array;
  createdAt?: number;
}
```

## Best Practices

1. Choose appropriate vector dimensions for your embedding model
2. Use meaningful metadata to organize knowledge
3. Consider chunking large text documents
4. Implement proper error handling
5. Monitor collection sizes and performance

## Performance Considerations

- Uses efficient upsert operations for knowledge creation
- Supports batch operations for better performance
- Implements proper vector type conversions
- Handles large text preprocessing efficiently
- Uses cosine similarity for optimal vector matching

## Requirements

- Node.js 23.3.0+
- Qdrant server running and accessible
- Valid API key for authentication
- Sufficient storage for vector data
