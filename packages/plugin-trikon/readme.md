# @elizaos/plugin-trikon

Trikon plugin for Eliza OS that provides token transfer functionality.

## Overview

This plugin is a Proof of Concept (POC) implementation for Trikon token transfers within the Eliza ecosystem. It provides basic token transfer capabilities and wallet management.

## Installation
pnpm add @elizaos/plugin-trikon

## Configuration

The plugin requires the following environment variables:

- `TRIKON_API_KEY`: Your Trikon API key.
- `TRIKON_INITIAL_BALANCE`: The initial balance for the wallet.

## Usage

To use the plugin, you need to add it to your Eliza OS project.

### Security Considerations

- Never share your wallet address or private keys
- Always validate transaction amounts
- Monitor transfer operations for suspicious activity

```typescript
import { trikonPlugin } from "@elizaos/plugin-trikon";

const eliza = new ElizaOS({
    plugins: [trikonPlugin],
});
```
