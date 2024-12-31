import {
    Action,
    ActionExample,
    elizaLogger,
    IAgentRuntime,
    Memory,
    State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { TokenResult } from "../types/api/search";
import {
    TokenMarketDataResponse,
    TokenOverviewResponse,
    TokenSecurityResponse,
    TokenTradeDataSingleResponse,
} from "../types/api/token";
import {
    extractChain,
    extractSymbols,
    formatPercentChange,
    formatPrice,
    formatTimestamp,
    formatValue,
    getTokenResultFromSearchResponse,
    shortenAddress,
} from "../utils";

const formatTokenReport = (
    token,
    metadata: TokenMarketDataResponse,
    security: TokenSecurityResponse,
    volume: TokenTradeDataSingleResponse,
    overview: TokenOverviewResponse
) => {
    let output = `*🛡️ Token Security and Trade Report*\n`;
    output += `🔖 Token symbol: ${token.symbol}\n`;
    output += `🔗 Token Address: ${shortenAddress(token.address)}\n\n`;

    if (security?.data) {
        output += `*👥 Ownership Distribution:*\n`;
        output += `- 🏠 Owner Address: ${shortenAddress(security.data.ownerAddress)}\n`;
        output += `- 👨‍💼 Creator Address: ${shortenAddress(security.data.creatorAddress)}\n`;
        output += `- 📦 Total Supply: ${formatValue(security.data.totalSupply)}\n`;
        output += `-  Mintable: ${security.data.mintable ?? "N/A"}\n`;
        output += `- 🔄 Proxied: ${security.data.proxied ?? "N/A"}\n`;
        output += `- 🔄 Proxy: ${security.data.proxy ?? "N/A"}\n`;
        if (security.data.securityChecks) {
            output += `- 🔍 Security Checks: ${JSON.stringify(security.data.securityChecks)}\n`;
        }
    }

    if (volume?.data) {
        output += `*📈 Trade Data:*\n`;
        output += `- 👥 Holders: ${volume.data.holder}\n`;
        output += `- 📊 Unique Wallets (24h): ${volume.data.unique_wallet_24h}\n`;
        output += `- 📉 Price Change (24h): ${formatPercentChange(volume.data.price_change_24h_percent)}\n`;
        output += `- 💸 Volume (24h USD): ${formatValue(volume.data.volume_24h_usd)}\n`;
        output += `- 💵 Current Price: ${formatPrice(volume.data.price)}\n`;
    }

    if (metadata?.data) {
        output += `*📊 Market Data:*\n`;
        output += `- 💧 Liquidity: ${formatValue(metadata.data.liquidity)}\n`;
        output += `- 💵 Price: ${formatPrice(metadata.data.price)}\n`;
        output += `- 📦 Supply: ${formatValue(metadata.data.supply)}\n`;
        output += `- 💰 Market Cap: ${formatValue(metadata.data.marketcap)}\n`;
        output += `- 🔄 Circulating Supply: ${formatValue(metadata.data.circulating_supply)}\n`;
        output += `- 💰 Circulating Market Cap: ${formatValue(metadata.data.circulating_marketcap)}\n`;
    }

    if (overview?.data) {
        output += `*🔍 Overview:*\n`;
        output += `- 📝 Name: ${overview.data.name}\n`;
        output += `- 🔖 Symbol: ${overview.data.symbol}\n`;
        output += `- 🔢 Decimals: ${overview.data.decimals}\n`;
        if (overview.data.extensions) {
            output += `- 🔗 Extensions: ${JSON.stringify(overview.data.extensions)}\n`;
        }
        output += `- 💧 Liquidity: ${formatValue(overview.data.liquidity)}\n`;
        output += `- ⏰ Last Trade Time: ${formatTimestamp(new Date(overview.data.lastTradeHumanTime).getTime() / 1000)}\n`;
        output += `- 💵 Price: ${formatPrice(overview.data.price)}\n`;
        output += `- 📜 Description: ${overview.data.extensions?.description ?? "N/A"}\n`;
    }

    return output;
};

export const getTokenInfoAction = {
    name: "GET_TOKEN_INFO",
    similes: [
        "FIND_TOKENS",
        "TOKEN_SEARCH",
        "LOOKUP_TOKENS",
        "CHECK_TOKEN",
        "REVIEW_TOKEN",
        "TOKEN_DETAILS",
        "GET_TOKEN_INFO",
        "TOKEN_INFO",
        "TOKEN_REPORT",
        "TOKEN_ANALYSIS",
        "TOKEN_OVERVIEW",
        "TOKEN_SUMMARY",
        "TOKEN_INSIGHT",
        "TOKEN_DATA",
        "TOKEN_STATS",
        "TOKEN_METRICS",
        "TOKEN_PROFILE",
        "TOKEN_REVIEW",
        "TOKEN_CHECK",
        "TOKEN_LOOKUP",
        "TOKEN_FIND",
        "TOKEN_DISCOVER",
        "TOKEN_EXPLORE",
    ],
    description:
        "Search for detailed token information including security and trade data by symbol",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: any
    ) => {
        try {
            const provider = new BirdeyeProvider(runtime.cacheManager);

            const symbols = extractSymbols(message.content.text, "strict");

            if (symbols.length === 0) {
                callback?.({ text: "No token symbols found in the message" });
                return true;
            }

            elizaLogger.info(
                `Searching Birdeye provider for ${symbols.length} symbols`
            );

            const searchTokenResponses = symbols.map((symbol) =>
                provider.fetchSearchTokenMarketData({
                    keyword: symbol,
                    sort_by: "volume_24h_usd",
                    sort_type: "desc",
                    chain: "all",
                    limit: 15,
                })
            );

            const results = await Promise.all(searchTokenResponses);

            // get only the token results where the symbol matches
            const validResults = results.map((r, index) =>
                getTokenResultFromSearchResponse(r, symbols[index])
            );

            // filter out undefined results
            const filteredResults = validResults.filter(
                (result): result is TokenResult => result !== undefined
            );

            if (filteredResults.length === 0) {
                callback?.({ text: "No matching tokens found" });
                return true;
            }

            const resultsWithChains = filteredResults.map((result) => ({
                symbol: result.symbol,
                address: result.address,
                chain: extractChain(result.address),
            }));

            // Fetch all data in parallel for each token
            const tokenData = await Promise.all(
                resultsWithChains.map(async ({ address, chain }) => {
                    const [metadata, security, volume, overview] =
                        await Promise.all([
                            provider.fetchTokenMarketData(
                                {
                                    address,
                                },
                                {
                                    headers: {
                                        "x-chain": chain,
                                    },
                                }
                            ),
                            provider.fetchTokenSecurityByAddress(
                                {
                                    address,
                                },
                                {
                                    headers: {
                                        "x-chain": chain,
                                    },
                                }
                            ),
                            provider.fetchTokenTradeDataSingle(
                                {
                                    address,
                                },
                                {
                                    headers: {
                                        "x-chain": chain,
                                    },
                                }
                            ),
                            provider.fetchTokenOverview(
                                {
                                    address,
                                },
                                {
                                    headers: {
                                        "x-chain": chain,
                                    },
                                }
                            ),
                        ]);
                    return { metadata, security, volume, overview };
                })
            );

            const completeResults = `Found the following token information:\n\n${validResults
                .map(
                    (result, index) =>
                        `${formatTokenReport(
                            result!,
                            tokenData[index].metadata,
                            tokenData[index].security,
                            tokenData[index].volume,
                            tokenData[index].overview
                        )}`
                )
                .join("\n\n")}`;

            callback?.({ text: completeResults });
            return true;
        } catch (error) {
            console.error("Error in searchTokens handler:", error.message);
            callback?.({ text: `Error: ${error.message}` });
            return false;
        }
    },
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const symbols = extractSymbols(message.content.text, "loose");
        return symbols.length > 0;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Search for $SOL and $ETH",
                    action: "SEARCH_TOKENS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Find information about $BTC",
                    action: "TOKEN_SEARCH",
                },
            },
            {
                user: "user",
                content: {
                    text: "Look up $WETH token",
                    action: "LOOKUP_TOKENS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Tell me about SOL",
                    action: "CHECK_TOKEN",
                },
            },
            {
                user: "user",
                content: {
                    text: "Give me details on $ADA",
                    action: "TOKEN_DETAILS",
                },
            },
            {
                user: "user",
                content: {
                    text: "What can you tell me about $DOGE?",
                    action: "TOKEN_INFO",
                },
            },
            {
                user: "user",
                content: {
                    text: "I need a report on $XRP",
                    action: "TOKEN_REPORT",
                },
            },
            {
                user: "user",
                content: {
                    text: "Analyze $BNB for me",
                    action: "TOKEN_ANALYSIS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Overview of $LTC",
                    action: "TOKEN_OVERVIEW",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
