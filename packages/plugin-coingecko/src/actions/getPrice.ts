import {
    ActionExample,
    composeContext,
    Content,
    elizaLogger,
    generateObject,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import axios from "axios";
import { z } from "zod";
import { validateCoingeckoConfig } from "../environment";

const GetPriceSchema = z.object({
    coinId: z.string(),
    currency: z.string().default("usd"),
});

export interface GetPriceContent extends Content {
    coinId: string;
    currency: string;
}

export function isGetPriceContent(
    content: GetPriceContent
): content is GetPriceContent {
    return (
        typeof content.coinId === "string" &&
        typeof content.currency === "string"
    );
}

const getPriceTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Here are several frequently used coin IDs. Use these for the corresponding tokens:
- bitcoin/btc: bitcoin
- ethereum/eth: ethereum
- usdc: usd-coin

Example response:
\`\`\`json
{
    "coinId": "bitcoin",
    "currency": "usd"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested price check:
- Coin ID
- Currency (defaults to USD)

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "GET_PRICE",
    similes: [
        "CHECK_PRICE",
        "PRICE_CHECK",
        "GET_CRYPTO_PRICE",
        "CHECK_CRYPTO_PRICE",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateCoingeckoConfig(runtime);
        return true;
    },
    description: "Get the current price of a cryptocurrency from CoinGecko",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CoinGecko GET_PRICE handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const priceContext = composeContext({
            state,
            template: getPriceTemplate,
        });

        const content = (
            await generateObject({
                runtime,
                context: priceContext,
                modelClass: ModelClass.SMALL,
                schema: GetPriceSchema,
            })
        ).object as unknown as GetPriceContent;

        if (!isGetPriceContent(content)) {
            console.error("Invalid content for GET_PRICE action.");
            if (callback) {
                callback({
                    text: "Unable to process price check request. Invalid content provided.",
                    content: { error: "Invalid price check content" },
                });
            }
            return false;
        }

        try {
            const config = await validateCoingeckoConfig(runtime);
            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/price`,
                {
                    params: {
                        ids: content.coinId,
                        vs_currencies: content.currency,
                        x_cg_demo_api_key: config.COINGECKO_API_KEY,
                    },
                }
            );

            const price = response.data[content.coinId][content.currency];
            elizaLogger.success(
                `Price retrieved successfully! ${content.coinId}: ${price} ${content.currency.toUpperCase()}`
            );

            if (callback) {
                callback({
                    text: `The current price of ${content.coinId} is ${price} ${content.currency.toUpperCase()}`,
                    content: { price, currency: content.currency },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error fetching price:", error);
            if (callback) {
                callback({
                    text: `Error fetching price: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the current price of Bitcoin?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Let me check the current Bitcoin price for you.",
                    action: "GET_PRICE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The current price of Bitcoin is 65,432.21 USD",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check ETH price in EUR",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the current Ethereum price in EUR.",
                    action: "GET_PRICE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The current price of Ethereum is 2,345.67 EUR",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
