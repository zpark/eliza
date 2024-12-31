import {
    Action,
    ActionExample,
    elizaLogger,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { TokenResult } from "../types/api/search";
import {
    extractChain,
    extractSymbols,
    getTokenResultFromSearchResponse,
} from "../utils";

const formatTokenReport = (token, metadata, security, volume) => {
    let output = `*Token Security and Trade Report*\n`;
    output += `Token symbol: ${token.symbol}\n`;
    output += `Token Address: ${token.address}\n\n`;

    if (security?.data) {
        output += `*Ownership Distribution:*\n`;
        output += `- Owner Balance: ${security.data.ownerBalance}\n`;
        output += `- Creator Balance: ${security.data.creatorBalance}\n`;
        output += `- Owner Percentage: ${security.data.ownerPercentage}%\n`;
        output += `- Creator Percentage: ${security.data.creatorPercentage}%\n`;
        output += `- Top 10 Holders Balance: ${security.data.top10HolderBalance}\n`;
        output += `- Top 10 Holders Percentage: ${security.data.top10HolderPercent}%\n\n`;
    }

    if (volume?.data) {
        output += `*Trade Data:*\n`;
        output += `- Holders: ${volume.data.holder}\n`;
        output += `- Unique Wallets (24h): ${volume.data.unique_wallet_24h}\n`;
        output += `- Price Change (24h): ${volume.data.price_change_24h_percent}%\n`;
        output += `- Price Change (12h): ${volume.data.price_change_12h_percent}%\n`;
        output += `- Volume (24h USD): $${volume.data.volume_24h_usd}\n`;
        output += `- Current Price: $${volume.data.price}\n\n`;
    }

    if (metadata) {
        output += `*Additional Info:*\n`;
        output += `- Name: ${metadata.name}\n`;
        output += `- Chain: ${metadata.chain}\n`;
        if (metadata.website) output += `- Website: ${metadata.website}\n`;
        if (metadata.twitter) output += `- Twitter: ${metadata.twitter}\n`;
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

            const symbols = extractSymbols(message.content.text, "loose");

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
                    limit: 1,
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
                    const [metadata, security, volume] = await Promise.all([
                        provider.fetchTokenMarketData({
                            address,
                            headers: {
                                chain,
                            },
                        }),
                        provider.fetchTokenSecurityByAddress({
                            address,
                            headers: {
                                chain,
                            },
                        }),
                        provider.fetchTokenTradeDataSingle({
                            address,
                            headers: {
                                chain,
                            },
                        }),
                    ]);
                    return { metadata, security, volume };
                })
            );

            const completeResults = `Found the following token information:\n\n${validResults
                .map(
                    (result, index) =>
                        `${formatTokenReport(
                            result!,
                            tokenData[index].metadata,
                            tokenData[index].security,
                            tokenData[index].volume
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
