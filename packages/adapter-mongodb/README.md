# MongoDB Adapter for ElizaOS

A MongoDB database adapter for ElizaOS that provides persistent storage capabilities with support for sharding, vector search, and real-time participant management.

## Features

- Automatic connection management and initialization
- Support for sharded collections
- Vector search index computation
- Participant and room management
- Account handling with JSON details storage
- Actor details aggregation
- Automatic reconnection handling

## Installation

```bash
pnpm add @elizaos/adapter-mongodb
```

## Configuration

The adapter requires the following environment variables:

```bash
MONGODB_URI=mongodb://your-mongodb-uri
MONGODB_DB_NAME=your-database-name
```

## Usage

### Basic Setup

```typescript
import { MongoDBAdapter } from '@elizaos/adapter-mongodb';

const adapter = new MongoDBAdapter({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB_NAME
});

// Initialize the connection
await adapter.init();
```

### Room Management

```typescript
// Get room by ID
const roomId = await adapter.getRoom(roomUUID);

// Get participants for a room
const participants = await adapter.getParticipantsForRoom(roomUUID);
```

### Participant Management

```typescript
// Get participants for an account
const participants = await adapter.getParticipantsForAccount(userUUID);

// Get participant state
const state = await adapter.getParticipantUserState(roomUUID, userUUID);

// Set participant state
await adapter.setParticipantUserState(roomUUID, userUUID, "FOLLOWED");
```

### Account Management

```typescript
// Get account by ID
const account = await adapter.getAccountById(userUUID);

// Create new account
const newAccount = {
  id: userUUID,
  name: "User Name",
  details: { /* account details */ }
};
const success = await adapter.createAccount(newAccount);
```

### Actor Details

```typescript
// Get actor details for a room
const actors = await adapter.getActorDetails({ roomId: roomUUID });
```

## Collection Structure

The adapter manages the following collections:

- `rooms`: Stores room information
- `participants`: Manages room participants and their states
- `accounts`: Stores user account information
- `memories`: Sharded collection for storing conversation memories

## Sharding

The adapter automatically configures sharding for the `memories` collection using the `roomId` as the shard key. This enables horizontal scaling for large conversation histories.

```typescript
// Sharding is automatically configured during initialization
// using a hashed shard key on roomId
```

## Error Handling

The adapter includes built-in error handling and connection management:

- Automatic reconnection on connection loss
- Connection state tracking
- Error logging for failed operations

## Development

### Prerequisites

- MongoDB 4.4+
- Node.js 23.3.0+
- pnpm
