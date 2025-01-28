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
import { ethers } from "ethers";

const generateNonce = (): string => {
    const expiredAt = (Date.now() + 1000 * 60 * 1) * (1 << 20); // 1 minutes
    // random number between 0 and 2^20
    const random = Math.floor(Math.random() * (1 << 20)) - 1;
    return (expiredAt + random).toString();
};

const generateJwt = async (
    endpoint: string,
    wallet: ethers.Wallet,
    subaccountId: number,
    nonce: string
): Promise<string> => {
    const message = `generate jwt for ${wallet.address?.toLowerCase()} and subaccount id ${subaccountId} to trade on happytrading.global with nonce: ${nonce}`;
    const signature = await wallet.signMessage(message);

    const rawResponse = await fetch(`${endpoint}/v2/auth/evm`, {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            account: wallet.address,
            subaccount_id: subaccountId.toString(),
            nonce,
            signature,
        }),
        method: "POST",
    });
    const response = await rawResponse.json();
    if (response.code === 200) {
        return response.data.jwt;
    } else {
        throw new DeskExchangeError("Could not generate JWT");
    }
};

const getSubaccount = (account: string, subaccountId: number): string => {
    // pad address with subaccountId to be 32 bytes (64 hex characters)
    //  0x + 40 hex characters (address) + 24 hex characters (subaccountId)
    const subaccountIdHex = BigInt(subaccountId).toString(16).padStart(24, "0");
    return account.concat(subaccountIdHex);
};

let jwt: string = null;

export const perpTrade: Action = {
    name: "PERP_TRADE",
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
        elizaLogger.info("DESK EXCHANGE", jwt);
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

        const endpoint =
            runtime.getSetting("DESK_EXCHANGE_NETWORK") === "mainnet"
                ? "https://trade-api.happytrading.global"
                : "https://stg-trade-api.happytrading.global";

        const wallet = new ethers.Wallet(
            runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY")
        );
        if (!jwt) {
            jwt = await generateJwt(endpoint, wallet, 0, generateNonce());
        }
        elizaLogger.info("jwt", jwt);
        elizaLogger.info(
            "Raw content from LLM:",
            JSON.stringify(content, null, 2)
        );

        const processesOrder = {
            symbol: `${content.symbol}USD`,
            side: content.side,
            amount: content.amount,
            price: content.price,
            nonce: generateNonce(),
            broker_id: "DESK",
            order_type: "Market",
            reduce_only: false,
            subaccount: getSubaccount(wallet.address, 0),
        };
        elizaLogger.info(
            "Processed order:",
            JSON.stringify(processesOrder, null, 2)
        );

        const rawResponse = await fetch(`${endpoint}/v2/place-order`, {
            headers: {
                authorization: `Bearer ${jwt}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(processesOrder),
            method: "POST",
        });
        const response = await rawResponse.json();
        elizaLogger.info(response);

        if (callback && response.code === 200) {
            callback({
                text: `Successfully placed a ${response.data.side} ${response.data.order_type} order of size ${response.data.quantity} on ${response.data.symbol} market at ${response.data.avg_fill_price} USD on DESK Exchange.`,
                content: response,
            });
        } else {
            callback({
                text: `Place order failed with ${response.errors}.`,
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
                    text: "Long 0.1 BTC at 20 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a buy order for 0.1 BTC at 20 USD.",
                    action: "PERP_TRADE",
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
                    text: "Short 2 BTC at 21 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a sell order for 2 BTC at 21 USD.",
                    action: "PERP_TRADE",
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

export default perpTrade;
