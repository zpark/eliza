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
    type Action,
} from "@elizaos/core";
import axios from "axios";
import { getApiConfig, validateCoingeckoConfig } from "../environment";
import { getCoinsData } from "../providers/coinsProvider";
import { getPriceTemplate } from "../templates/price";

interface CurrencyData {
    [key: string]: number;
    usd?: number;
    eur?: number;
    usd_market_cap?: number;
    eur_market_cap?: number;
    usd_24h_vol?: number;
    eur_24h_vol?: number;
    usd_24h_change?: number;
    eur_24h_change?: number;
    last_updated_at?: number;
}

interface PriceResponse {
    [coinId: string]: CurrencyData;
}

export interface GetPriceContent extends Content {
    coinIds: string | string[];
    currency: string;
    include_market_cap?: boolean;
    include_24hr_vol?: boolean;
    include_24hr_change?: boolean;
    include_last_updated_at?: boolean;
}

function formatCoinIds(input: string | string[]): string {
    if (Array.isArray(input)) {
        return input.join(',');
    }
    return input;
}

function formatCurrencies(input: string | string[]): string {
    if (Array.isArray(input)) {
        return input.join(',');
    }
    return input;
}

export default {
    name: "GET_PRICE",
    similes: [
        "COIN_PRICE_CHECK",
        "SPECIFIC_COINS_PRICE",
        "COIN_PRICE_LOOKUP",
        "SELECTED_COINS_PRICE",
        "PRICE_DETAILS",
        "COIN_PRICE_DATA"
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateCoingeckoConfig(runtime);
        return true;
    },
    description: "Get price and basic market data for one or more specific cryptocurrencies (by name/symbol)",
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

        try {
            elizaLogger.log("Composing price context...");
            // Compose price check context
            const priceContext = composeContext({
                state,
                template: getPriceTemplate,
            });

            elizaLogger.log("Generating content from template...");
            const content = (await generateObjectDeprecated({
                runtime,
                context: priceContext,
                modelClass: ModelClass.LARGE,
            })) as unknown as GetPriceContent;

            elizaLogger.log("Generated content:", content);

            // Validate content structure
            if (!content || typeof content !== "object") {
                throw new Error("Invalid response format from model");
            }

            if (!content.coinIds) {
                throw new Error("No cryptocurrency specified");
            }

            // Format coin IDs for API request
            const coinIds = formatCoinIds(content.coinIds);
            const currency = ((content.currency as string) || "usd").toLowerCase();

            elizaLogger.log("Formatted request parameters:", { coinIds, currency });

            // Fetch price from CoinGecko
            const config = await validateCoingeckoConfig(runtime);
            const { baseUrl, apiKey } = getApiConfig(config);

            elizaLogger.log(`Fetching prices for ${coinIds} in ${currency}...`);
            elizaLogger.log("API request URL:", `${baseUrl}/simple/price`);
            elizaLogger.log("API request params:", {
                ids: coinIds,
                vs_currencies: currency,
                include_market_cap: content.include_market_cap || false,
                include_24hr_vol: content.include_24hr_vol || false,
                include_24hr_change: content.include_24hr_change || false,
                include_last_updated_at: content.include_last_updated_at || false
            });

            const response = await axios.get<PriceResponse>(
                `${baseUrl}/simple/price`,
                {
                    params: {
                        ids: coinIds,
                        vs_currencies: currency,
                        include_market_cap: content.include_market_cap || false,
                        include_24hr_vol: content.include_24hr_vol || false,
                        include_24hr_change: content.include_24hr_change || false,
                        include_last_updated_at: content.include_last_updated_at || false
                    },
                    headers: {
                        'accept': 'application/json',
                        'x-cg-pro-api-key': apiKey
                    }
                }
            );

            if (Object.keys(response.data).length === 0) {
                throw new Error("No price data available for the specified coins and currency");
            }

            // Get coins data for formatting
            const coins = await getCoinsData(runtime);

            // Format response text for each coin
            const formattedResponse = Object.entries(response.data).map(([coinId, data]) => {
                if (!data || !data[currency]) {
                    return null;
                }

                const coin = coins.find(c => c.id === coinId);
                const coinName = coin ? `${coin.name} (${coin.symbol.toUpperCase()})` : coinId;
                const upperCurrency = currency.toUpperCase();
                const parts = [
                    `${coinName}:`,
                    `  ${upperCurrency}: ${data[currency].toLocaleString(undefined, {
                        style: 'currency',
                        currency: currency
                    })}`
                ];

                // Add market cap if requested and available
                if (content.include_market_cap) {
                    const marketCap = data[`${currency}_market_cap`];
                    if (marketCap !== undefined) {
                        parts.push(`  Market Cap: ${marketCap.toLocaleString(undefined, {
                            style: 'currency',
                            currency: currency,
                            maximumFractionDigits: 0
                        })}`);
                    }
                }

                // Add 24h volume if requested and available
                if (content.include_24hr_vol) {
                    const volume = data[`${currency}_24h_vol`];
                    if (volume !== undefined) {
                        parts.push(`  24h Volume: ${volume.toLocaleString(undefined, {
                            style: 'currency',
                            currency: currency,
                            maximumFractionDigits: 0
                        })}`);
                    }
                }

                // Add 24h change if requested and available
                if (content.include_24hr_change) {
                    const change = data[`${currency}_24h_change`];
                    if (change !== undefined) {
                        const changePrefix = change >= 0 ? '+' : '';
                        parts.push(`  24h Change: ${changePrefix}${change.toFixed(2)}%`);
                    }
                }

                // Add last updated if requested
                if (content.include_last_updated_at && data.last_updated_at) {
                    const lastUpdated = new Date(data.last_updated_at * 1000).toLocaleString();
                    parts.push(`  Last Updated: ${lastUpdated}`);
                }

                return parts.join('\n');
            }).filter(Boolean);

            if (formattedResponse.length === 0) {
                throw new Error("Failed to format price data for the specified coins");
            }

            const responseText = formattedResponse.join('\n\n');
            elizaLogger.success("Price data retrieved successfully!");

            if (callback) {
                callback({
                    text: responseText,
                    content: {
                        prices: Object.entries(response.data).reduce((acc, [coinId, data]) => ({
                            ...acc,
                            [coinId]: {
                                price: data[currency],
                                marketCap: data[`${currency}_market_cap`],
                                volume24h: data[`${currency}_24h_vol`],
                                change24h: data[`${currency}_24h_change`],
                                lastUpdated: data.last_updated_at,
                            }
                        }), {}),
                        currency: currency.toUpperCase()
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_PRICE handler:", error);

            let errorMessage;
            if (error.response?.status === 429) {
                errorMessage = "Rate limit exceeded. Please try again later.";
            } else if (error.response?.status === 403) {
                errorMessage = "This endpoint requires a CoinGecko Pro API key. Please upgrade your plan to access this data.";
            } else if (error.response?.status === 400) {
                errorMessage = "Invalid request parameters. Please check your input.";
            } else {
                errorMessage = `Error fetching price data: ${error.message}`;
            }

            if (callback) {
                callback({
                    text: errorMessage,
                    content: {
                        error: error.message,
                        statusCode: error.response?.status,
                        params: error.config?.params,
                        requiresProPlan: error.response?.status === 403
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
                    text: "What's the current price of Bitcoin?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the current Bitcoin price for you.",
                    action: "GET_PRICE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The current price of Bitcoin is {{dynamic}} USD",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check ETH and BTC prices in EUR with market cap",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the current prices with market cap data.",
                    action: "GET_PRICE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Bitcoin: EUR {{dynamic}} | Market Cap: €{{dynamic}}\nEthereum: EUR {{dynamic}} | Market Cap: €{{dynamic}}",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
