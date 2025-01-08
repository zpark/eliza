# @elizaos/plugin-primus

This adapter integrates Primus Protocol into ElizaOS, enabling verifiable inference results from various AI model providers. It implements the `IVerifiableInferenceAdapter` interface, making it compatible with other verifiable inference solutions.

## Installation

```bash
pnpm add @elizaos/plugin-primus
```

## Configuration

Add the following environment variables to your `.env` file:
```env
PRIMUS_APP_ID=your_app_id
PRIMUS_APP_SECRET=your_app_secret
# Set to true to enable verifiable inference
VERIFIABLE_INFERENCE_ENABLED=true 
# Options: primus, reclaim, opacity, use primus for this plugin
VERIFIABLE_INFERENCE_PROVIDER=primus
```
***How to get PRIMUS_APP_ID and PRIMUS_APP_SECRET***
1. Visit https://dev.primuslabs.xyz/
2. Login
3. Create a new project
4. Save your 'Application ID(PRIMUS_APP_ID)' and 'Secret Key(PRIMUS_APP_SECRET)'

After completing the above steps, you can start the agent.
