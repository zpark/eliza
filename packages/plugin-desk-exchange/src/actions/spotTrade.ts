import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    ModelClass,
} from "@elizaos/core";
import { DeskExchangeError } from "../types.js";
import { perpTradeTemplate } from "../templates.js";

const generateNonce = (): bigint => {
    const expiredAt = BigInt(Date.now() + 1000 * 60 * 5) * BigInt(1 << 20); // 5 minutes
    // random number between 0 and 2^20
    const random = Math.floor(Math.random() * (1 << 20)) - 1;
    return expiredAt + BigInt(random);
};

export const spotTrade: Action = {
    name: "SPOT_TRADE",
    similes: ["PERP_ORDER", "PERP_BUY", "PERP_SELL"],
    description: "Place a perpetual contract trade order on DESK Exchange",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        elizaLogger.info("DESK EXCHANGE");
        // Initialize or update state
        state = !state
            ? await runtime.composeState(message)
            : await runtime.updateRecentMessageState(state);

        const context = composeContext({
            state,
            template: perpTradeTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        if (!content) {
            throw new DeskExchangeError(
                "Could not parse trading parameters from conversation"
            );
        }

        elizaLogger.info(
            "Raw content from LLM:",
            JSON.stringify(content, null, 2)
        );

        const processesOrder = {
            symbol: `${content.symbol}USD`,
            side: content.side,
            amount: content.amount,
            price: content.price,
            nonce: generateNonce().toString(),
            broker_id: "DESK",
            order_type: "Market",
            reduce_only: false,
            subaccount:
                "0x6629eC35c8Aa279BA45Dbfb575c728d3812aE31a000000000000000000000000",
        };
        elizaLogger.info(
            "Processed order:",
            JSON.stringify(processesOrder, null, 2)
        );

        const rawResponse = await fetch(
            "https://stg-trade-api.happytrading.global/v2/place-order",
            {
                headers: {
                    authorization:
                        "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NDA1NjAyNTAsImFjY291bnQiOiIweDY2MjllQzM1YzhBYTI3OUJBNDVEYmZiNTc1YzcyOGQzODEyYUUzMWEiLCJzdWJhY2NvdW50X2lkIjowfQ.RUazgjZM3Vulq1MAQ22eYmVVAH1pHbsqzG18VP9VPyI",
                    "content-type": "application/json",
                },
                body: JSON.stringify(processesOrder),
                method: "POST",
            }
        );
        const response = await rawResponse.json();
        elizaLogger.info(response);

        if (callback && response.code === 200) {
            callback({
                text: `Successfully placed a ${response.data.order_type} order of size ${response.data.quantity} on ${response.data.symbol} market at ${response.data.avg_fill_price} USD on DESK Exchange.`,
                content: response,
            });
        }

        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Buy 0.1 BTC at 20 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a buy order for 0.1 BTC at 20 USD.",
                    action: "SPOT_TRADE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully placed a limit order to buy 0.1 BTC at 20 USD",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Sell 2 BTC at 21 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a sell order for 2 BTC at 21 USD.",
                    action: "SPOT_TRADE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully placed a limit order to sell 2 BTC at 21 USD",
                },
            },
        ],
    ] as ActionExample[][],
};

export default spotTrade;
