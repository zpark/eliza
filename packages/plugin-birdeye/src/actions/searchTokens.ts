import {
    Action,
    ActionExample,
    composeContext,
    elizaLogger,
    generateText,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { extractChain, extractSymbols } from "../utils";

const extractTokenSymbolsTemplate = `Given the recent message below:
{{recentMessages}}
Extract all token symbols mentioned in the message. Look for:
- Symbols prefixed with $ (e.g. $SOL, $ETH)
- Well-known symbols in any case (e.g. BTC, eth, SOL)
- Other symbols that are in all caps (e.g. SOL, SUI, NUER)
- Quoted symbols

When symbols are in lowercase (btc, eth, sol), convert to well-known format (BTC, ETH, SOL).
For mixed case symbols (SOl, eTH), include them as-is unless quoted.

Respond with a JSON array containing only the extracted symbols, no extra description needed.
Example:
Message: "Check $SOL and btc prices"
Response: ["SOL", "BTC"]`;

const extractTokenSymbolsFromMessage = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
) => {
    const context = composeContext({
        state,
        template: extractTokenSymbolsTemplate,
    });

    const response = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });

    try {
        const regex = new RegExp(/\[(.+)\]/gms);
        const normalized = response && regex.exec(response)?.[0];
        return normalized ? JSON.parse(normalized) : [];
    } catch {
        return [];
    }
};

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

export const searchTokensBySymbolAction = {
    name: "SEARCH_TOKENS_BY_SYMBOL",
    similes: [
        "FIND_TOKENS",
        "TOKEN_SEARCH",
        "LOOKUP_TOKENS",
        "CHECK_TOKEN",
        "REVIEW_TOKEN",
        "TOKEN_DETAILS",
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

            const symbols = await extractTokenSymbolsFromMessage(
                runtime,
                message,
                state
            );

            if (symbols.length === 0) {
                callback?.({ text: "No token symbols found in the message" });
                return true;
            }

            elizaLogger.info(
                `Searching Birdeye provider for ${symbols.length} symbols`
            );

            const searchTokenResponses = symbols.map((symbol) =>
                provider.fetchSearchTokens({
                    keyword: symbol,
                    limit: 1,
                })
            );

            const results = await Promise.all(searchTokenResponses);
            const validResults = results.map(
                (r, index) =>
                    r.data.items.find(
                        (item) =>
                            item.type === "token" &&
                            item.result[0].symbol.toLowerCase() ===
                                symbols[index].toLowerCase()
                    )?.result[0]
            );

            if (validResults.length === 0) {
                callback?.({ text: "No matching tokens found" });
                return true;
            }

            const resultsWithChains = validResults.map((result) => ({
                symbol: result.symbol,
                address: result.address,
                chain: extractChain(result.address),
            }));

            // Fetch all data in parallel for each token
            const tokenData = await Promise.all(
                resultsWithChains.map(async ({ address, chain, symbol }) => {
                    const [metadata, security, volume] = await Promise.all([
                        provider.fetchTokenMetadata(address, chain),
                        provider.fetchTokenSecurityBySymbol(symbol),
                        provider.fetchTokenTradeDataBySymbol(symbol),
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
        ],
    ] as ActionExample[][],
} as Action;
