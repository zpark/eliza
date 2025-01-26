import {
    ActionExample,
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import axios from "axios";
import { validateMoralisConfig } from "../../environment";
import { getTokenStatsTemplate } from "../../templates/tokenStats";
import { API_ENDPOINTS, SOLANA_API_BASE_URL } from "../../utils/constants";
import { TokenStatsContent, TokenStats } from "../../types/solana";

export default {
    name: "GET_SOLANA_TOKEN_STATS",
    similes: [
        "FETCH_SOLANA_TOKEN_STATS",
        "GET_SOLANA_TOKEN_METRICS",
        "SHOW_SOLANA_TOKEN_STATS",
        "CHECK_SOLANA_TOKEN_STATS",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateMoralisConfig(runtime);
        return true;
    },
    description:
        "Get aggregated statistics across all pairs for a specific token on Solana blockchain",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting Moralis GET_SOLANA_TOKEN_STATS handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
            elizaLogger.log("Composing token stats context...");
            const statsContext = composeContext({
                state,
                template: getTokenStatsTemplate,
            });

            elizaLogger.log("Extracting token address...");
            const content = (await generateObjectDeprecated({
                runtime,
                context: statsContext,
                modelClass: ModelClass.LARGE,
            })) as unknown as TokenStatsContent;

            if (!content || typeof content !== "object") {
                throw new Error("Invalid response format from model");
            }

            if (!content.tokenAddress) {
                throw new Error("No Solana token address provided");
            }

            const config = await validateMoralisConfig(runtime);
            elizaLogger.log(
                `Fetching stats for Solana token ${content.tokenAddress}...`
            );

            const response = await axios.get<TokenStats>(
                `${SOLANA_API_BASE_URL}${API_ENDPOINTS.SOLANA.TOKEN_STATS(content.tokenAddress)}`,
                {
                    headers: {
                        "X-API-Key": config.MORALIS_API_KEY,
                        accept: "application/json",
                    },
                }
            );

            const stats = response.data;
            elizaLogger.success(
                `Successfully fetched aggregated stats for token ${content.tokenAddress}`
            );

            if (callback) {
                const formattedStats =
                    `Token Statistics Overview:\n\n` +
                    `Market Overview:\n` +
                    `- Total Liquidity: $${Math.round(stats.totalLiquidityUsd).toLocaleString()}\n` +
                    `- Active Pairs: ${stats.totalActivePairs}\n` +
                    `- Active DEXes: ${stats.totalActiveDexes}\n\n` +
                    `24h Trading Activity:\n` +
                    `- Total Volume: $${Math.round(stats.totalVolume["24h"]).toLocaleString()}\n` +
                    `  • Buy Volume: $${Math.round(stats.totalBuyVolume["24h"]).toLocaleString()}\n` +
                    `  • Sell Volume: $${Math.round(stats.totalSellVolume["24h"]).toLocaleString()}\n` +
                    `- Total Trades: ${stats.totalSwaps["24h"].toLocaleString()}\n` +
                    `- Unique Traders:\n` +
                    `  • Buyers: ${stats.totalBuyers["24h"]}\n` +
                    `  • Sellers: ${stats.totalSellers["24h"]}\n\n` +
                    `Recent Activity (Past Hour):\n` +
                    `- Volume: $${Math.round(stats.totalVolume["1h"]).toLocaleString()}\n` +
                    `- Trades: ${stats.totalSwaps["1h"]}\n` +
                    `- Active Traders: ${stats.totalBuyers["1h"] + stats.totalSellers["1h"]}`;

                callback({
                    text: formattedStats,
                    content: stats,
                });
            }

            return true;
        } catch (error: any) {
            elizaLogger.error(
                "Error in GET_SOLANA_TOKEN_STATS handler:",
                error
            );
            const errorMessage = error.response?.data?.message || error.message;
            if (callback) {
                callback({
                    text: `Error fetching Solana token stats: ${errorMessage}`,
                    content: { error: errorMessage },
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
                    text: "Get aggregated stats for Solana token SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll fetch the aggregated statistics for this Solana token.",
                    action: "GET_SOLANA_TOKEN_STATS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me overall trading metrics for Solana token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll retrieve the overall trading statistics for this Solana token.",
                    action: "GET_SOLANA_TOKEN_STATS",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
