import {
    Action,
    ActionExample,
    Content,
    elizaLogger,
    Handler,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "@elizaos/core";
import {
    BASE_URL,
    Chain,
    extractChain,
    extractContractAddresses,
    extractLimit,
    formatTimestamp,
    formatValue,
    makeApiRequest,
    shortenAddress,
} from "../../providers/utils";
import { getTokenMetadata, TokenMetadataResponse } from "./get-token-metadata";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exampleResponse = {
    success: true,
    data: {
        items: [
            {
                quote: {
                    symbol: "POTUS",
                    decimals: 6,
                    address: "7hyHfdgxwtaj1QpQSJw3s4R2LMxShPpmr2GsCw9npump",
                    amount: 13922809,
                    feeInfo: null,
                    uiAmount: 13.922809,
                    price: null,
                    nearestPrice: 0.00008581853084042329,
                    changeAmount: 13922809,
                    uiChangeAmount: 13.922809,
                },
                base: {
                    symbol: "SOL",
                    decimals: 9,
                    address: "So11111111111111111111111111111111111111112",
                    amount: 9090,
                    uiAmount: 0.00000909,
                    price: null,
                    nearestPrice: 128.201119598627,
                    changeAmount: -9090,
                    uiChangeAmount: -0.00000909,
                },
                basePrice: null,
                quotePrice: null,
                txHash: "5G72183B77KafzKv4GEJNnDrV7rtspv5X5WM9yG9g1P89iG1UCGBuAqcMasgGhRYN24bmWsNPkQqptRbX5uoH44K",
                source: "raydium",
                blockUnixTime: 1726676178,
                txType: "swap",
                owner: "AavgaV4YKned3RN6JVMANKmAaVS2Tpfnw88HbYtzgBAn",
                side: "sell",
                alias: null,
                pricePair: 1531662.1562156219,
                from: {
                    symbol: "SOL",
                    decimals: 9,
                    address: "So11111111111111111111111111111111111111112",
                    amount: 9090,
                    uiAmount: 0.00000909,
                    price: null,
                    nearestPrice: 128.201119598627,
                    changeAmount: -9090,
                    uiChangeAmount: -0.00000909,
                },
                to: {
                    symbol: "POTUS",
                    decimals: 6,
                    address: "7hyHfdgxwtaj1QpQSJw3s4R2LMxShPpmr2GsCw9npump",
                    amount: 13922809,
                    feeInfo: null,
                    uiAmount: 13.922809,
                    price: null,
                    nearestPrice: 0.00008581853084042329,
                    changeAmount: 13922809,
                    uiChangeAmount: 13.922809,
                },
                tokenPrice: null,
                poolId: "2L8fo6g6me9ZubZhH2iiz6616GouRbGeEuvNoGv69xWE",
            },
            {
                quote: {
                    symbol: "PEAKY",
                    decimals: 6,
                    address: "62uBW5K24PdxXk185tNjz9pwzkpHinKt8qZznxPPpump",
                    amount: 35238136,
                    feeInfo: null,
                    uiAmount: 35.238136,
                    price: null,
                    nearestPrice: 0.00003742796781669965,
                    changeAmount: 35238136,
                    uiChangeAmount: 35.238136,
                },
                base: {
                    symbol: "SOL",
                    decimals: 9,
                    address: "So11111111111111111111111111111111111111112",
                    amount: 10333,
                    uiAmount: 0.000010333,
                    price: null,
                    nearestPrice: 128.201119598627,
                    changeAmount: -10333,
                    uiChangeAmount: -0.000010333,
                },
                basePrice: null,
                quotePrice: null,
                txHash: "zXdSLDTX4MVzunVJgFbJmiLY9z2hZ3n28w6bYvKn1aZVL1QZGozkyMMMteFqpyWraUTdRyX1GKFnJYkqPsL5SJK",
                source: "raydium",
                blockUnixTime: 1726676178,
                txType: "swap",
                owner: "CDt3xtwPVWDbhENL3QhDX5XYVx9JNCvewfdfCRy1cKFt",
                side: "sell",
                alias: null,
                pricePair: 3410252.2016839255,
                from: {
                    symbol: "SOL",
                    decimals: 9,
                    address: "So11111111111111111111111111111111111111112",
                    amount: 10333,
                    uiAmount: 0.000010333,
                    price: null,
                    nearestPrice: 128.201119598627,
                    changeAmount: -10333,
                    uiChangeAmount: -0.000010333,
                },
                to: {
                    symbol: "PEAKY",
                    decimals: 6,
                    address: "62uBW5K24PdxXk185tNjz9pwzkpHinKt8qZznxPPpump",
                    amount: 35238136,
                    feeInfo: null,
                    uiAmount: 35.238136,
                    price: null,
                    nearestPrice: 0.00003742796781669965,
                    changeAmount: 35238136,
                    uiChangeAmount: 35.238136,
                },
                tokenPrice: null,
                poolId: "5vsk6iYjKXEo6x7maZJwh36UjqwFxkRtoHK5Nphh3ht1",
            },
        ],
        hasNext: true,
    },
};

type TokenTradesResponse = typeof exampleResponse;

// Constants for keyword matching
const TOKEN_TRADES_KEYWORDS = [
    "token trades",
    "token swaps",
    "token transactions",
    "token activity",
    "token orders",
    "token executions",
    "token trading",
    "token market activity",
    "token exchange activity",
    "token trading history",
    "token market history",
    "token exchange history",
] as const;

// Helper function to check if text contains trades-related keywords
const containsTokenTradesKeyword = (text: string): boolean => {
    return TOKEN_TRADES_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};

const getTokenTrades = async (
    apiKey: string,
    contractAddress: string,
    chain: Chain,
    limit: number
): Promise<TokenTradesResponse | null> => {
    try {
        const params = new URLSearchParams({
            address: contractAddress,
            limit: limit.toString(),
        });
        const url = `${BASE_URL}/defi/trades_token?${params.toString()}`;

        elizaLogger.info(
            `Fetching token trades for ${contractAddress} on ${chain} from:`,
            url
        );

        return await makeApiRequest<TokenTradesResponse>(url, {
            apiKey,
            chain,
        });
    } catch (error) {
        if (error instanceof Error) {
            elizaLogger.error("Error fetching token trades:", error.message);
        }
        return null;
    }
};

const formatTrade = (
    trade: TokenTradesResponse["data"]["items"][0]
): string => {
    const timestamp = formatTimestamp(trade.blockUnixTime);
    const side = trade.side === "buy" ? "🟢 Buy" : "🔴 Sell";
    const baseAmount = formatValue(trade.base.uiAmount);
    const quoteAmount = formatValue(trade.quote.uiAmount);

    let response = `${side} - ${timestamp}\n`;
    response += `• ${baseAmount} ${trade.base.symbol} ⇄ ${quoteAmount} ${trade.quote.symbol}\n`;
    response += `• Source: ${trade.source}\n`;
    response += `• Owner: ${shortenAddress(trade.owner)}\n`;
    response += `• Tx: ${shortenAddress(trade.txHash)}`;

    return response;
};

const formatTokenTradesResponse = (
    data: TokenTradesResponse,
    tokenMetadata: TokenMetadataResponse | null,
    chain: Chain
): string => {
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);

    let tokenInfo = "Unknown Token";
    let tokenLinks = "";

    if (tokenMetadata?.success) {
        const { name, symbol, extensions } = tokenMetadata.data;
        tokenInfo = `${name} (${symbol})`;

        const links = [];
        if (extensions.website) links.push(`[Website](${extensions.website})`);
        if (extensions.coingecko_id)
            links.push(
                `[CoinGecko](https://www.coingecko.com/en/coins/${extensions.coingecko_id})`
            );
        if (links.length > 0) {
            tokenLinks = `\n📌 More Information: ${links.join(" • ")}`;
        }
    }

    let response = `Recent Trades for ${tokenInfo} on ${chainName}${tokenLinks}\n\n`;

    if (!data.success || !data.data.items || data.data.items.length === 0) {
        return response + "No trades found.";
    }

    const trades = data.data.items;

    // Calculate summary statistics
    const buyTrades = trades.filter((t) => t.side === "buy");
    const buyRatio = (buyTrades.length / trades.length) * 100;

    const baseVolume = trades.reduce(
        (sum, t) => sum + Math.abs(t.base.uiAmount),
        0
    );
    const quoteVolume = trades.reduce(
        (sum, t) => sum + Math.abs(t.quote.uiAmount),
        0
    );
    const averageBaseAmount = baseVolume / trades.length;
    const averageQuoteAmount = quoteVolume / trades.length;

    response += `📊 Summary\n`;
    response += `• Total Trades: ${trades.length}\n`;
    response += `• Buy/Sell Ratio: ${buyRatio.toFixed(1)}% buys\n`;
    response += `• Total Volume: ${formatValue(baseVolume)} ${trades[0].base.symbol}\n`;
    response += `• Average Trade Size: ${formatValue(averageBaseAmount)} ${trades[0].base.symbol}\n`;
    response += `• Total Quote Volume: ${formatValue(quoteVolume)} ${trades[0].quote.symbol}\n`;
    response += `• Average Quote Size: ${formatValue(averageQuoteAmount)} ${trades[0].quote.symbol}\n\n`;

    // Add market analysis
    const tradeFrequency =
        trades.length > 20 ? "high" : trades.length > 10 ? "moderate" : "low";
    const volumeLevel =
        baseVolume > averageBaseAmount * 2
            ? "high"
            : baseVolume > averageBaseAmount
              ? "moderate"
              : "low";
    const marketAnalysis = `Market shows ${tradeFrequency} trading activity with ${volumeLevel} volume per trade.`;

    response += `📈 Market Analysis\n`;
    response += `• ${marketAnalysis}\n\n`;

    response += `🔄 Recent Trades\n`;
    trades.forEach((trade, index) => {
        response += `${index + 1}. ${formatTrade(trade)}\n\n`;
    });

    if (data.data.hasNext) {
        response += `Note: More trades are available. This is a limited view of the most recent activity.`;
    }

    return response;
};

export const getTokenTradesAction: Action = {
    name: "GET_TOKEN_TRADES",
    similes: [
        "SHOW_TOKEN_TRADES",
        "VIEW_TOKEN_TRADES",
        "CHECK_TOKEN_TRADES",
        "DISPLAY_TOKEN_TRADES",
        "GET_TRADE_HISTORY",
        "SHOW_TRADE_HISTORY",
        "VIEW_TRADING_ACTIVITY",
        "CHECK_MARKET_ACTIVITY",
        "TOKEN_TRADING_HISTORY",
        "TOKEN_MARKET_ACTIVITY",
    ],
    description:
        "Retrieve and analyze recent trading activity for a token, including trade details, volume statistics, and market analysis.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined
    ): Promise<boolean> => {
        return containsTokenTradesKeyword(message.content.text);
    },
    handler: (async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined,
        _options: any,
        callback: HandlerCallback
    ): Promise<Content> => {
        const callbackData: Content = {
            text: "",
            action: "GET_TOKEN_TRADES_RESPONSE",
            source: message.content.source,
        };

        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            callbackData.text =
                "I'm unable to fetch the token trades due to missing API credentials.";
            await callback(callbackData);
            return callbackData;
        }

        const messageText = message.content.text;
        const addresses = extractContractAddresses(messageText);
        if (addresses.length === 0) {
            callbackData.text =
                "I couldn't find a valid token address in your message.";
            await callback(callbackData);
            return callbackData;
        }

        const chain = extractChain(messageText);
        const limit = extractLimit(messageText);

        // First fetch token metadata
        const tokenMetadata = await getTokenMetadata(
            apiKey,
            addresses[0],
            chain
        );

        elizaLogger.info(
            `TOKEN TRADES action activated for ${addresses[0]} on ${chain}`
        );

        const tradesData = await getTokenTrades(
            apiKey,
            addresses[0],
            chain,
            limit
        );

        if (!tradesData) {
            callbackData.text =
                "I apologize, but I couldn't retrieve the token trades at the moment.";
            await callback(callbackData);
            return callbackData;
        }

        callbackData.text = formatTokenTradesResponse(
            tradesData,
            tokenMetadata,
            chain
        );
        await callback(callbackData);
        return callbackData;
    }) as Handler,
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me recent trades for token 0x1234... on Ethereum",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's the detailed trading activity analysis including recent trades, volume statistics, and market insights.",
                    action: "GET_TOKEN_TRADES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the trading activity for ABC123... on Solana?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll analyze the recent trading activity and provide you with a comprehensive overview of the market.",
                    action: "GET_TOKEN_TRADES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get me the last 20 trades for token XYZ... on BSC",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll fetch the recent trades and provide detailed statistics about the trading activity.",
                    action: "GET_TOKEN_TRADES",
                },
            },
        ],
    ] as ActionExample[][],
};
