# @elizaos/plugin-lit

A comprehensive blockchain interaction plugin for the Eliza Agent Stack, powered by Lit Protocol's Programmable Key Pairs (PKPs). This plugin enables autonomous agents to perform secure cross-chain transactions through decentralized key management and threshold cryptography.

## Overview

The Lit Protocol plugin provides:
- Dual-chain wallet management (EVM + Solana)
- Secure transaction signing and execution
- Capacity credit management
- Automated PKP lifecycle management
- Security evaluations for transactions

## Features

- **Wallet Management**
  - Automated PKP creation and management
  - Dual-chain support (EVM + Solana)
  - Secure key storage and rotation
  - Capacity credit allocation

- **Transaction Support**
  - ETH transfers
  - USDC transfers
  - SOL transfers
  - Transaction security validation

- **Security Features**
  - Transaction amount limits
  - Security evaluations
  - PKP validation
  - Session management
  - Capacity credit monitoring

## Installation
```bash
npm install @elizaos/plugin-lit
```

## Configuration

Required environment variables:
```env
FUNDING_PRIVATE_KEY=   # Private key for funding operations
EVM_RPC_URL=           # RPC endpoint for blockchain interactions
LIT_PKP_PUBLIC_KEY=    # (Optional) Existing PKP public key
```

## Important: Wallet Funding

Before executing any transactions, you must fund the generated Lit wallet address with the necessary assets (ETH, SOL, or USDC). The plugin will create a new PKP wallet address if one isn't provided, and this address will need to hold sufficient funds to:
1. Cover the amount being transferred
2. Pay for transaction fees (gas fees on EVM chains, transaction fees on Solana)

You can view your PKP wallet address after initializing the plugin using the configuration file (`lit-config.json`).

## Usage

### Basic Setup
```typescript
import { litPlugin } from '@elizaos/plugin-lit';

// Register the plugin
runtime.registerPlugin(litPlugin);
```

### Sending ETH
```typescript
// Send ETH transaction
await runtime.executeAction('SEND_ETH', {
  text: "Send 0.01 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
});
```

### Sending SOL
```typescript
// Send SOL transaction
await runtime.executeAction('SEND_SOL', {
  text: "Send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
});
```

### Sending USDC
```typescript
// Send USDC transaction
await runtime.executeAction('SEND_USDC', {
  text: "Send 10 USDC to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
});
```

## Security

The plugin implements multiple security layers:
- Transaction amount limits
- Automated security evaluations
- PKP validation checks
- Session-based authentication
- Capacity credit management
- Automatic key rotation

## Architecture

The plugin consists of several key components:

- **Providers**
  - `litProvider`: Manages PKP creation and Lit Protocol integration
  - `pkpPermissionsProvider`: Handles PKP permissions and auth methods

- **Actions**
  - `sendEth`: ETH transfer functionality
  - `sendSol`: SOL transfer functionality
  - `sendUSDC`: USDC transfer functionality

## Configuration Management

The plugin uses a local configuration file (`lit-config.json`) to store:
- PKP details
- Network configuration
- Wallet information
- Capacity credits
- Session data

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## License

MIT
