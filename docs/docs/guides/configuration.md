---
sidebar_position: 9
---

# ⚙️ Configuration Guide

This guide covers how to configure Eliza for different use cases and environments. We'll walk through all available configuration options and best practices.

## Environment Configuration

### Basic Setup

The first step is creating your environment configuration file:

```bash
cp .env.example .env
```

### Core Environment Variables

Here are the essential environment variables you need to configure:

```bash
# Core API Keys
OPENAI_API_KEY=sk-your-key # Required for OpenAI features
ANTHROPIC_API_KEY=your-key  # Required for Claude models
TOGETHER_API_KEY=your-key   # Required for Together.ai models

# Default Settings
XAI_MODEL=gpt-4o-mini      # Default model to use
X_SERVER_URL=              # Optional model API endpoint
```

### Client-Specific Configuration

#### Discord Configuration

```bash
DISCORD_APPLICATION_ID=     # Your Discord app ID
DISCORD_API_TOKEN=         # Discord bot token
```

#### Twitter Configuration

```bash
TWITTER_USERNAME=          # Bot Twitter username
TWITTER_PASSWORD=          # Bot Twitter password
TWITTER_EMAIL=            # Twitter account email
TWITTER_DRY_RUN=false    # Test mode without posting
```

#### Telegram Configuration

```bash
TELEGRAM_BOT_TOKEN=       # Telegram bot token
```

### Model Provider Settings

You can configure different AI model providers:

```bash
# OpenAI Settings
OPENAI_API_KEY=sk-*

# Anthropic Settings
ANTHROPIC_API_KEY=

# Together.ai Settings
TOGETHER_API_KEY=

# Heurist Settings
HEURIST_API_KEY=

# Livepeer Settings
LIVEPEER_GATEWAY_URL=

# Local Model Settings
XAI_MODEL=meta-llama/Llama-3.1-7b-instruct
```

# Feature Request: **nineteen.ai** Integration

## Relevance
Eliza currently supports various AI providers but lacks native integration with **nineteen.ai**, which offers high-performance language models for free. Users currently need manual configuration and workarounds to use **nineteen.ai **models through the OpenAI compatibility layer.

## Solution description
Add native support for **nineteen.ai** as a dedicated model provider in Eliza, similar to existing providers like OpenAI and Anthropic. This includes:

1. New Provider Implementation:
- Add `ModelProviderName.NINETEEN_AI`
- Implement SN19-specific configuration handling
- Add proper model mapping and endpoint management

2. Configuration Updates:

```
NINETEEN_API_KEY=       # nineteen.ai API key (from https://nineteen.ai/app/api)
NINETEEN_API_URL=       # Default: https://api.nineteen.ai/v1
SMALL_NINETEEN_MODEL=unsloth/Llama-3.2-3B-Instruct
MEDIUM_NINETEEN_MODEL=unsloth/Meta-Llama-3.1-8B-Instruct
LARGE_NINETEEN_MODEL=hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4
```

## Implementation Details

The PR will add:

- New provider type in `packages/core/src/types.ts`
- **nineteen.ai **provider implementation in `packages/core/src/generation.ts`
- Documentation updates in `docs/`
- Environment variable examples in `.env.example`

## Testing Plan

- Get a free api key from https://nineteen.ai/app/api
- Add the following env variables in the `.env` :
`NINETEEN_API_KEY=XXX
NINETEEN_API_URL=https://api.nineteen.ai/v1 SMALL_NINETEEN_MODEL=unsloth/Llama-3.2-3B-Instruct       MEDIUM_NINETEEN_MODEL=unsloth/Meta-Llama-3.1-8B-Instruct LARGE_NINETEEN_MODEL=hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4`
- Test provider initialization, model selection, API key validation, request/response handling and error scenarios / fallbacks


### Image Generation

Configure image generation in your character file:

```json
{
    "modelProvider": "heurist",
    "settings": {
        "imageSettings": {
            "steps": 20,
            "width": 1024,
            "height": 1024
        }
    }
}
```

Example usage:

```typescript
const result = await generateImage(
    {
        prompt: 'A cute anime girl with big breasts and straight long black hair wearing orange T-shirt. The T-shirt has "ai16z" texts in the front. The girl is looking at the viewer',
        width: 1024,
        height: 1024,
        numIterations: 20, // optional
        guidanceScale: 3, // optional
        seed: -1, // optional
        modelId: "FLUX.1-dev", // optional
    },
    runtime,
);
```

## Character Configuration

### Character File Structure

Character files define your agent's personality and behavior. Create them in the `characters/` directory:

```json
{
    "name": "AgentName",
    "clients": ["discord", "twitter"],
    "modelProvider": "openai",
    "settings": {
        "secrets": {
            "OPENAI_API_KEY": "character-specific-key",
            "DISCORD_TOKEN": "bot-specific-token"
        }
    }
}
```

### Loading Characters

You can load characters in several ways:

```bash
# Load default character
pnpm start

# Load specific character
pnpm start --characters="characters/your-character.json"

# Load multiple characters
pnpm start --characters="characters/char1.json,characters/char2.json"
```

## Custom Actions

### Adding Custom Actions

1. Create a `custom_actions` directory
2. Add your action files there
3. Configure in `elizaConfig.yaml`:

```yaml
actions:
    - name: myCustomAction
      path: ./custom_actions/myAction.ts
```

### Action Configuration Structure

```typescript
export const myAction: Action = {
    name: "MY_ACTION",
    similes: ["SIMILAR_ACTION", "ALTERNATE_NAME"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Validation logic
        return true;
    },
    description: "Action description",
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        // Action logic
        return true;
    },
};
```

## Provider Configuration

### Database Providers

Configure different database backends:

```typescript
// SQLite (Recommended for development)
import { SqliteDatabaseAdapter } from "@your-org/agent-framework/adapters";
const db = new SqliteDatabaseAdapter("./dev.db");

// PostgreSQL (Production)
import { PostgresDatabaseAdapter } from "@your-org/agent-framework/adapters";
const db = new PostgresDatabaseAdapter({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
```

### Model Providers

Configure model providers in your character file:

```json
{
    "modelProvider": "openai",
    "settings": {
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "maxTokens": 2000
    }
}
```

## Advanced Configuration

### Runtime Settings

Fine-tune runtime behavior:

```typescript
const settings = {
    // Logging
    DEBUG: "eliza:*",
    LOG_LEVEL: "info",

    // Performance
    MAX_CONCURRENT_REQUESTS: 5,
    REQUEST_TIMEOUT: 30000,

    // Memory
    MEMORY_TTL: 3600,
    MAX_MEMORY_ITEMS: 1000,
};
```

### Plugin Configuration

Enable and configure plugins in `elizaConfig.yaml`:

```yaml
plugins:
    - name: solana
      enabled: true
      settings:
          network: mainnet-beta
          endpoint: https://api.mainnet-beta.solana.com

    - name: image-generation
      enabled: true
      settings:
          provider: dalle
          size: 1024x1024
```

## Configuration Best Practices

1. **Environment Segregation**

    - Use different `.env` files for different environments
    - Follow naming convention: `.env.development`, `.env.staging`, `.env.production`

2. **Secret Management**

    - Never commit secrets to version control
    - Use secret management services in production
    - Rotate API keys regularly

3. **Character Configuration**

    - Keep character files modular and focused
    - Use inheritance for shared traits
    - Document character behaviors

4. **Plugin Management**

    - Enable only needed plugins
    - Configure plugin-specific settings in separate files
    - Monitor plugin performance

5. **Database Configuration**
    - Use SQLite for development
    - Configure connection pooling for production
    - Set up proper indexes

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**

    ```bash
    # Check .env file location
    node -e "console.log(require('path').resolve('.env'))"

    # Verify environment variables
    node -e "console.log(process.env)"
    ```

2. **Character Loading Failures**

    ```bash
    # Validate character file
    npx ajv validate -s character-schema.json -d your-character.json
    ```

3. **Database Connection Issues**
    ```bash
    # Test database connection
    npx ts-node scripts/test-db-connection.ts
    ```

### Configuration Validation

Use the built-in config validator:

```bash
pnpm run validate-config
```

This will check:

- Environment variables
- Character files
- Database configuration
- Plugin settings

## Further Resources

- [Quickstart Guide](../quickstart.md) for initial setup
- [Secrets Management](./secrets-management.md) for secure configuration
- [Local Development](./local-development.md) for development setup
- [Advanced Usage](./advanced.md) for complex configurations
