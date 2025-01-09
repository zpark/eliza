# @elizaos/plugin-primus

A plugin to fully verify agent activities, including LLM access, actions, and interactions with external providers,
powered by Primus' zkTLS protocol.

## Overview

Here's a refined version of your text:

In the Eliza framework, an agent consists of three key components: a brain (accessing an LLM), actions (the tasks the
agent performs), and perception (gathering external information from providers). To fully verify agent activities, it's
essential to ensure that the agent's thoughts, actions, and external information requests are all verifiable. This
plugin enables full verification of these activities.

The current plugin includes:

- Verification of inference from OpenAI's LLM.
- An example for verifying actions, such as posting a tweet (this can be extended to any other actions).
- An example to verify that the Bitcoin price is accurately fetched from Binance (this can be extended to any other data
  providers).

## Primus Adapter
### LLM inference Usage (PrimusAdapter)
```typescript
import {PrimusAdapter} from "@elizaos/plugin-primus";
import {VerifiableInferenceOptions} from '@elizaos/core';

// Initialize primus adapter
const primusAdatper = new PrimusAdapter({
    appId: process.env.PRIMUS_APP_ID,
    appSecret: process.env.PRIMUS_APP_SECRET,
    attMode: "proxytls",
    modelProvider: character.modelProvider,
    token,
});

interface PrimusOptions {
    appId: string;
    appSecret: string;
    attMode: string;
    modelProvider?: ModelProviderName;
    token?: string;
}

// The options for generating an attestation
const options: VerifiableInferenceOptions = {
    // Optional: Override the default endpoint
    endpoint: "https://api.openapi.com/chat/completions",
    // Optional: Add custom headers
    headers: {
        "Content-Type": "application/json",
        "Authorization": "bearer Token",
    },
    // Optional: Provider-specific options
    providerOptions: {
        temperature: 0.7,
    },
};

// Generate an attestation for a network request.
const result = await primusAdapter.generateText(context, "gpt-4o", options);
// Verify the validity of the attestation.
const isValid = await primusAdapter.verifyProof(result.proof);
```

This plugin offers the following features:

- Generate an attestation for a network request.
- Verify the validity of the attestation.

You can find detail code at [primusUtil.ts](./src/util/primusUtil.ts)
#### generateProof
```typescript
generateProof = async (
    // The target endpoint of the network request.
    endpoint: string,
    // The HTTP method of the request, such as 'GET', 'POST', etc.
    method: string,
    // A record containing the headers of the request.
    headers: Record<string, any>,
    // The body of the request. It should be a string.
    body: string,
    //A [JSONPath](https://datatracker.ietf.org/doc/rfc9535/) expression to locate the specific field in the response you want to attest.
    responseParsePath: string
): Promise<any>
```
***returns***  
When a successful data verification process is completed, you will receive a standard [attestation](https://docs.primuslabs.xyz/data-verification/zk-tls-sdk/production#understanding-the-data-verification-structure)

#### verifyProof

Verify the attestation is valid.

```typescript
 // The attestation is generated during a network request.
 // Returns true: The attestation is valid. false : The attestation is invalid.
 verifyProof = async (attestation: any): Promise<boolean>
```
***Below are examples illustrating how to use these functions.***


### Providers

Developers can use the zktls module provided by Primus to attest providers. Providers are core modules responsible for
injecting dynamic context and real-time information into agent interactions. Therefore, it is crucial for agents to
validate that the information received from providers is authentic.

Below is an example demonstrating how to verify that the BTC price from Binance is valid:

```typescript

const tokenPriceProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        // get btc price
        const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
        const method = 'GET';
        const headers = {
            'Accept	': '*/*',
        };
        // generate proof
        const attestation = await generateProof(url, method, headers, "", "$.price");
        // you can verify the proof is valid
        const valid = await verifyProof(attestation);
        if (!valid) {
            throw new Error("Invalid price attestation");
        }
    ......
    },
};
```

You can see more examples at [providers](./src/providers/tokenPriceProvider.ts)

### Actions

Primus ensures the reliability of both the provider's data source and the operations performed by actions. Below is an
example demonstrating how to post price information from the [tokenPriceProvider](./src/providers/tokenPriceProvider.ts)
to Twitter:

```typescript

export const postTweetAction: Action = {
  description: "",
  examples: [],
  handler: async (
          runtime: IAgentRuntime,
          message: Memory,
          state?: State
  ): Promise<boolean> => {
    const contentYouWantToPost = await tokenPriceProvider.get(runtime, message, state);
    const endpoint = 'https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet';
    const method = 'POST';
    const attestation = await generateProof(endpoint,method,headers,bodyStr,"$.data.create_tweet.tweet_results.result.rest_id");
    elizaLogger.info(
            "Tweet posting proof generated successfully:",
            attestation
    );
    const verifyResult = verifyProof(attestation);
    if (!verifyResult) {
      throw new Error(
              "Attestation verify failed, data from source is illegality"
      );
    }

  },
  name: "",
  similes: [],
  validate: async (
          runtime: IAgentRuntime,
          message: Memory,
          state?: State
  ) => {},
};
```

For more details, refer to [postTweetAction.ts](./src/actions/postTweetAction.ts)

## Installation

```bash
pnpm add @elizaos/plugin-primus
```

## Configuration

Add the following environment variables to your .env file:

```
PRIMUS_APP_ID=your_app_id
PRIMUS_APP_SECRET=your_app_secret
VERIFIABLE_INFERENCE_ENABLED=true 
VERIFIABLE_INFERENCE_PROVIDER=primus
```

***How to get PRIMUS_APP_ID and PRIMUS_APP_SECRET***

1. Visit https://dev.primuslabs.xyz/
2. Create a new project
3. Save your 'Application ID(PRIMUS_APP_ID)' and 'Secret Key(PRIMUS_APP_SECRET)'

If you want to run [postTweetAction](./src/actions/postTweetAction.ts), please add these variables to your `.env` file:

```dotenv
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email# Recommand: for 2FA
TWITTER_2FA_SECRET=your_2fa_secret# Optional: for 2FA
TWITTER_PREMIUM=false# Optional: enables premium features
TWITTER_DRY_RUN=false# Optional: test without posting
```

## Usage

To use the plugin, add `@elizaos/plugin-primus` to the plugins field in your character file. Here's an example of how
your character file might look after the update:

```json
{
  "name": "trump",
  "modelProvider": "openai",
  // just support openai now
  "plugins": [
    "@elizaos/plugin-primus"
  ],
  // other  fields
  .....
}
```

## Run

```bash
# Run with your character file
pnpm start --characters="characters/xxx.character.json"
```

## Chat with Your Agent

[Here are examples show how to chat with agent](./src/actions/postTweetAction.ts).

