# @elizaos/plugin-primus

A plugin to fully verify agent activities, including LLM access, actions, and interactions with external providers, powered by Primus' zkTLS protocol.

## Overview

Here's a refined version of your text:

In the Eliza framework, an agent consists of three key components: a brain (accessing an LLM), actions (the tasks the agent performs), and perception (gathering external information from providers). To fully verify agent activities, it's essential to ensure that the agent's thoughts, actions, and external information requests are all verifiable. This plugin enables full verification of these activities.

The current plugin includes:

- Verification of inference from OpenAI's LLM.
- An example for verifying actions, such as posting a tweet (this can be extended to any other actions).
- An example to verify that the Bitcoin price is accurately fetched from Binance (this can be extended to any other data providers).


## What we do?
This plugin offers the following features:

- Generate an attestation for a network request.
- Verify the validity of the attestation.

You can find detail code at [primusUtil.ts](./src/util/primusUtil.ts)

### generateProof
```typescript
generateProof = async (
    endpoint: string,
    method: string,
    headers: Record<string, any>,
    body: string,
    responseParsePath: string
): Promise<any>
```
***parameters***
- ***endpoint***: The target endpoint of the network request.
- ***method***: The HTTP method of the request, such as 'GET', 'POST', etc.
- ***headers***: A record containing the headers of the request.
- ***body*** : The body of the request. It should be a string.
- ***responseParsePath***: A JSONPath expression to locate the specific field in the response you want to attest. Currently, only JSONPath expressions are supported ([ What is JSONPath](https://datatracker.ietf.org/doc/rfc9535/))

***returns***
When a successful data verification process is completed, you will receive a standard verification structure with the following details:
```json
  {
  "recipient": "YOUR_USER_ADDRESS", // user's wallet address, default is 0x0000000000000000000000000000000000000000
  "request": { // request of data verification
    "url": "REQUEST_URL", // request url for verification
    "header": "REQUEST_HEADER", // request header
    "method": "REQUEST_METHOD", // request method
    "body": "REQUEST_BODY" // request body
  },
  "reponseResolve": [ // data verification response items
    {
      "keyName": "VERIFY_DATA_ITEMS", // the "verify data items" you set in the template
      "parseType": "",
      "parsePath": "DARA_ITEM_PATH" // json path of the data for verification
    }
  ],
  "data": "{ACTUAL_DATA}", // actual data items in the request, stringified JSON object
  "attConditions": "[RESPONSE_CONDITIONS]", // verification response conditions, stringified JSON object
  "timestamp": TIMESTAMP_OF_VERIFICATION_EXECUTION, // timestamp of verification execution
  "additionParams": "", // additionParams from zkTLS sdk
  "attestors": [ // information of the attestors
    {
      "attestorAddr": "ATTESTOR_ADDRESS",  // the address of the attestor
      "url": "https://primuslabs.org"        // the attestor's url
    }
  ],
  "signatures": [
    "SIGNATURE_OF_THIS_VERIFICATION" // attestor's signature for this verification
  ]
}
```
### verifyProof
Verify the attestation is valid.
```typescript
 verifyProof = async (attestation: any): Promise<boolean>
```
***parameters***

- ***attestation***: The attestation is generated during a network request.

***returns***
- true : The attestation is valid.
- false : The attestation is invalid.

***Below are examples illustrating how to use these functions.***

### model
Developers can leverage the zktls module provided by Primus to attest OpenAI requests. The following is a detailed example:
```typescript

export class PrimusAdapter implements IVerifiableInferenceAdapter {
    /**
     * Generate proof of communication with OpenAI
     */
    async generateText(
        context: string,
        modelClass: string,
        options?: VerifiableInferenceOptions
    ): Promise<VerifiableInferenceResult> {
        //other code is hidden
        ......
        // Get provider-specific endpoint, auth header and response json path
        let endpoint;
        let authHeader;
        let responseParsePath;
        
        switch (provider) {
            case ModelProviderName.OPENAI:
                //The endpoint of the request
                endpoint = `${baseEndpoint}/chat/completions`;
                authHeader = `Bearer ${apiKey}`;
                //The JSONPath to extract the content field from OpenAI's response.
                responseParsePath = "$.choices[0].message.content";
                break;
            default:
                throw new Error(`Unsupported model provider: ${provider}`);
        }
        //The headers of the request
        const headers = {
            "Content-Type": "application/json",
            "Authorization": authHeader,
        };

        try {
            //The body of the request
            let body = {
                model: model.name,
                messages: [{ role: "user", content: context }],
                temperature:
                    options?.providerOptions?.temperature ||
                    models[provider].model[modelClass].temperature,
            };
            //generate proof
            const attestation = await generateProof(endpoint,"POST",headers,JSON.stringify(body),responseParsePath);
            elizaLogger.log(`model attestation:`, attestation);
            
            const responseData = JSON.parse(attestation.data);
            let text = JSON.parse(responseData.content);
            return {
                text,
                proof: attestation,
                provider: VerifiableInferenceProvider.PRIMUS,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error("Error in Primus generateText:", error);
            throw error;
        }
    }
    //verify the proof
    async verifyProof(result: VerifiableInferenceResult): Promise<boolean> {
        const isValid = verifyProof(result.proof)
        elizaLogger.log("Proof is valid:", isValid);
        return isValid;
    }
}

```
You can see full code at [primusAdapter.ts](./src/adapter/primusAdapter.ts)

### Provider
Developers can use the zktls module provided by Primus to attest providers. Providers are core modules responsible for injecting dynamic context and real-time information into agent interactions. Therefore, it is crucial for agents to validate that the information received from providers is authentic.

Below is an example demonstrating how to verify that the BTC price from Binance is valid:
```typescript

const tokenPriceProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        //get btc price
        const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
        const method = 'GET';
        const headers = {
            'Accept	': '*/*',
        };
        //generate proof
        const attestation = await generateProof(url, method, headers, "", "$.price");
        //you can verify the proof is valid
        const valid = await verifyProof(attestation);
        if(!valid){
            throw new Error("Invalid price attestation");
        }
        elizaLogger.info('price attestation:',attestation);
        const responseData = JSON.parse((attestation as any).data);
        const price = responseData.content;
        return  `
        Get BTC price from Binance:
        BTC: ${price} USDT
        Time: ${new Date().toUTCString()}
        POST by eliza #zilia
        Attested by Primus #primus #zktls
        `
    },
};
```
You can see more examples at [providers](./src/providers/tokenPriceProvider.ts)

### actions
Primus ensures the reliability of both the provider's data source and the operations performed by actions. Below is an example demonstrating how to post price information from the [tokenPriceProvider](./src/providers/tokenPriceProvider.ts) to Twitter:
```typescript
const contentYouWantToPost = await tokenPriceProvider.get(runtime, message, state);
//other code is hidden
try {
    //login
    const scraperWithPrimus = new TwitterScraper();
    await scraperWithPrimus.login();
    if (!(await scraperWithPrimus.getScraper().isLoggedIn())) {
        elizaLogger.error("Failed to login to Twitter");
        return false;
    }
    // post the tweet
    elizaLogger.log("Attempting to send tweet:", contentYouWantToPost);
    const endpoint = 'https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet';
    const method = 'POST';
    //generate proof
    const attestation = await generateProof(endpoint,method,headers,bodyStr,"$.data.create_tweet.tweet_results.result.rest_id");

    elizaLogger.info(
        "Tweet posting proof generated successfully:",
        attestation
    );

    const verifyResult = verifyProof(attestation);
    if (!verifyResult) {
        throw new Error(
            "Verify attestation failed, data from source is illegality"
        );
    }
    return true;
} catch (error) {
    elizaLogger.error("Error in post action:", error);
    return false;
}
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

To use the plugin, add `@elizaos/plugin-primus` to the plugins field in your character file. Here's an example of how your character file might look after the update:

```json
{
  "name": "trump",
  "modelProvider": "openai",//just support openai now
  "plugins": [
    "@elizaos/plugin-primus"
  ],
  //other  fields
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

