import {
    ActionExample,
    composeContext,
    Content,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action
} from "@elizaos/core";
import axios from "axios";
import { getApiConfig, validateCoingeckoConfig } from "../environment";
import { getTopGainersLosersTemplate } from "../templates/gainersLosers";

interface TopGainerLoserItem {
    id: string;
    symbol: string;
    name: string;
    image: string;
    market_cap_rank: number;
    usd: number;
    usd_24h_vol: number;
    usd_24h_change: number;
}

interface TopGainersLosersResponse {
    top_gainers: TopGainerLoserItem[];
    top_losers: TopGainerLoserItem[];
}

export interface GetTopGainersLosersContent extends Content {
    vs_currency?: string;
    duration?: '24h' | '7d' | '14d' | '30d' | '60d' | '1y';
    top_coins?: string;
}

export default {
    name: "GET_TOP_GAINERS_LOSERS",
    similes: [
        "TOP_MOVERS",
        "BIGGEST_GAINERS",
        "BIGGEST_LOSERS",
        "PRICE_CHANGES",
        "BEST_WORST_PERFORMERS",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateCoingeckoConfig(runtime);
        return true;
    },
    description: "Get list of top gaining and losing cryptocurrencies by price change",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
            // Compose context
            const context = composeContext({
                state,
                template: getTopGainersLosersTemplate,
            });

            const content = (await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.LARGE,
            })) as unknown as GetTopGainersLosersContent;

            // Fetch data from CoinGecko
            const config = await validateCoingeckoConfig(runtime);
            const { baseUrl, apiKey, headerKey } = getApiConfig(config);

            const response = await axios.get<TopGainersLosersResponse>(
                `${baseUrl}/coins/top_gainers_losers`,
                {
                    headers: {
                        'accept': 'application/json',
                        [headerKey]: apiKey
                    },
                    params: {
                        vs_currency: content.vs_currency || 'usd',
                        duration: content.duration || '24h',
                        top_coins: content.top_coins || '1000'
                    }
                }
            );

            if (!response.data) {
                throw new Error("No data received from CoinGecko API");
            }

            // No need to sort - API returns data already sorted
            const formattedData = {
                gainers: response.data.top_gainers.map(coin => ({
                    name: coin.name,
                    symbol: coin.symbol.toUpperCase(),
                    price: coin.usd,
                    priceChange: coin.usd_24h_change,
                    volume24h: coin.usd_24h_vol,
                    marketCapRank: coin.market_cap_rank
                })).slice(0, 15),
                losers: response.data.top_losers.map(coin => ({
                    name: coin.name,
                    symbol: coin.symbol.toUpperCase(),
                    price: coin.usd,
                    priceChange: coin.usd_24h_change,
                    volume24h: coin.usd_24h_vol,
                    marketCapRank: coin.market_cap_rank
                })).slice(0, 15)
            };

            const responseText = [
                'Top Gainers:',
                ...formattedData.gainers.map((coin, index) =>
                    `${index + 1}. ${coin.name} (${coin.symbol})` +
                    ` | $${coin.price.toLocaleString()}` +
                    ` | ${coin.priceChange.toFixed(2)}%` +
                    `${coin.marketCapRank ? ` | Rank #${coin.marketCapRank}` : ''}`
                ),
                '',
                'Top Losers:',
                ...formattedData.losers.map((coin, index) =>
                    `${index + 1}. ${coin.name} (${coin.symbol})` +
                    ` | $${coin.price.toLocaleString()}` +
                    ` | ${coin.priceChange.toFixed(2)}%` +
                    `${coin.marketCapRank ? ` | Rank #${coin.marketCapRank}` : ''}`
                )
            ].join('\n');

            if (callback) {
                callback({
                    text: responseText,
                    content: {
                        data: formattedData,
                        params: {
                            vs_currency: content.vs_currency || 'usd',
                            duration: content.duration || '24h',
                            top_coins: content.top_coins || '1000'
                        },
                        timestamp: new Date().toISOString()
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_TOP_GAINERS_LOSERS handler:", error);

            const errorMessage = error.response?.status === 429 ?
                "Rate limit exceeded. Please try again later." :
                `Error fetching top gainers/losers data: ${error.message}`;

            if (callback) {
                callback({
                    text: errorMessage,
                    content: {
                        error: error.message,
                        statusCode: error.response?.status
                    },
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
                    text: "What are the top gaining and losing cryptocurrencies?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the top gainers and losers for you.",
                    action: "GET_TOP_GAINERS_LOSERS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are the top gainers and losers:\nTop Gainers:\n1. Bitcoin (BTC) | $45,000 | +5.2% | Rank #1\n{{dynamic}}",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me the best and worst performing crypto today",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll fetch the current top movers in the crypto market.",
                    action: "GET_TOP_GAINERS_LOSERS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are today's best and worst performers:\n{{dynamic}}",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;