# Spheron Protocol Plugin for Eliza

This plugin integrates the Spheron Protocol SDK into the Eliza ecosystem, providing functionality for managing deployments, escrow operations, and lease management.

## Features

- **Escrow Operations**: Manage token deposits, withdrawals, and balance checks
- **Deployment Management**: Create, update, and manage deployments using ICL YAML
- **Lease Operations**: Handle lease details, states, and lifecycle management

## Installation

```bash
npm install @elizaos/plugin-spheron
```

## Configuration

The plugin requires the following environment variables:

```env
PRIVATE_KEY=your_private_key
PROVIDER_PROXY_URL=your_provider_proxy_url
WALLET_ADDRESS=your_wallet_address (optional)
```

## Usage

1. Import and register the plugin:

```typescript
import { spheronPlugin } from "@elizaos/plugin-spheron";

// Register with Eliza
eliza.registerPlugin(spheronPlugin);
```

2. Available Actions:

- `ESCROW_OPERATION`: Handle token deposits and withdrawals
- `DEPLOYMENT_OPERATION`: Manage service deployments
- `LEASE_OPERATION`: Handle lease lifecycle

## Examples

### Escrow Operations

```typescript
// Deposit tokens
await runtime.executeAction("ESCROW_OPERATION", {
    token: "USDT",
    amount: 100,
    operation: "deposit",
});

// Withdraw tokens
await runtime.executeAction("ESCROW_OPERATION", {
    token: "USDC",
    amount: 50,
    operation: "withdraw",
});
```

### Deployment Operations

```typescript
// Create deployment
await runtime.executeAction("DEPLOYMENT_OPERATION", {
    operation: "create",
    template: "jupyter-notebook",
    customizations: {
        cpu: false,
        resources: {
            cpu: "4",
            memory: "8Gi",
            gpu: "1",
            gpu_model: "rtx4090",
        },
    },
});

// Update deployment
await runtime.executeAction("DEPLOYMENT_OPERATION", {
    operation: "update",
    leaseId: "your_lease_id",
    iclYaml: "updated ICL YAML configuration",
});

// Close deployment
await runtime.executeAction("DEPLOYMENT_OPERATION", {
    operation: "close",
    leaseId: "your_lease_id",
});
```

## Supported Tokens

- USDT
- USDC
- DAI
- WETH

## Development

1. Install dependencies:

```bash
npm install
```

2. Build the plugin:

```bash
npm run build
```

3. Run tests:

```bash
npm test
```

## License

This project is licensed under the Apache License 2.0.
