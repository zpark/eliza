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
import { accountSummaryTemplate, perpTradeTemplate } from "../templates.js";
import { ethers } from "ethers";
import axios from "axios";
import {
    generateNonce,
    generateJwt,
    getSubaccount,
    getEndpoint,
} from "../services/utils";
import { getSubaccountSummary } from "../services/account.js";

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
        return !!(
            runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY") &&
            runtime.getSetting("DESK_EXCHANGE_NETWORK")
        );
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
            template: accountSummaryTemplate,
        });

        try {
            const endpoint = getEndpoint(runtime);
            const wallet = new ethers.Wallet(
                runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY")
            );
            const jwt = await generateJwt(endpoint, wallet, 0, generateNonce());

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
            elizaLogger.error("Error getting account summary:", {
                message: error.message,
                code: error.code,
                data: error.response?.data,
            });
            if (callback) {
                callback({
                    text: `Error getting account summary: ${error.message} ${error.response?.data?.errors}`,
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
                    text: "Check my account please",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here is the summary of your account",
                    action: "GET_PERP_ACCOUNT_SUMMARY",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "How is my account doing?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here is the summary of your account",
                    action: "GET_PERP_ACCOUNT_SUMMARY",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Account summary",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here is the summary of your account",
                    action: "GET_PERP_ACCOUNT_SUMMARY",
                },
            },
        ],
    ] as ActionExample[][],
};

export default accountSummary;
