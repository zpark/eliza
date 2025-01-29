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
import { DeskExchangeError, PlaceOrderSchema } from "../types.js";
import { perpTradeTemplate } from "../templates.js";
import { ethers } from "ethers";
import axios from "axios";
import {
    generateNonce,
    generateJwt,
    getSubaccount,
    getEndpoint,
} from "../services/utils";
import { getSubaccountSummary } from "../services/account.js";

let jwt: string = null;

export const accountSummary: Action = {
    name: "GET_PERP_ACCOUNT_SUMMARY",
    similes: [
        "CHECK_ACCOUNT",
        "CHECK_PERP_ACCOUNT",
        "ACCOUNT_SUMMARY",
        "PERP_ACCOUNT_SUMMARY",
    ],
    description: "Get the current account summary",
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

        try {
            const endpoint = getEndpoint(runtime);
            const wallet = new ethers.Wallet(
                runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY")
            );
            if (!jwt) {
                jwt = await generateJwt(endpoint, wallet, 0, generateNonce());
            }
            elizaLogger.info("jwt", jwt);
            const response = await getSubaccountSummary(
                endpoint,
                jwt,
                getSubaccount(wallet.address, 0)
            );
            elizaLogger.info(response.data);

            const subaccountSummaryData = response.data.data;
            const positionSummary =
                subaccountSummaryData.positions.length > 0
                    ? subaccountSummaryData.positions
                          .map((p) => {
                              return `- ${p.side} ${p.quantity} ${p.symbol}`;
                          })
                          .join("\n")
                    : "- No active position";
            const orderSummary =
                subaccountSummaryData.open_orders.length > 0
                    ? subaccountSummaryData.open_orders
                          .map((o) => {
                              return `- ${o.side === "Long" ? "Buy" : "Sell"} ${
                                  Number(o.original_quantity) -
                                  Number(o.remaining_quantity)
                              }/${o.original_quantity} ${o.symbol} @${
                                  Number(o.price) > 0
                                      ? o.price
                                      : o.trigger_price
                              }`;
                          })
                          .join("\n")
                    : "- No orders";
            const collateralSummary =
                subaccountSummaryData.collaterals.length > 0
                    ? subaccountSummaryData.collaterals
                          .map((c) => {
                              return `- ${c.amount} ${c.asset}`;
                          })
                          .join("\n")
                    : "- No collateral";
            callback({
                text:
                    `Here is the summary of your account ${wallet.address}\n` +
                    `Your positions:\n` +
                    positionSummary +
                    `\n` +
                    `Your orders:\n` +
                    orderSummary +
                    `\n` +
                    `Your collaterals:\n` +
                    collateralSummary,
                content: subaccountSummaryData,
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error executing trade:", {
                content,
                message: error.message,
                code: error.code,
                data: error.response?.data,
            });
            if (callback) {
                callback({
                    text: `Error executing trade: ${error.message} ${error.response?.data?.errors}`,
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

export default accountSummary;
