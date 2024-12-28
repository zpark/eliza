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
import { getTokenMetadata } from "../../services";
import { BirdeyeChain } from "../../types/shared";
import { TokenMetadataResponse } from "../../types/token-metadata";
import {
    BASE_URL,
    extractChain,
    extractContractAddresses,
    formatTimestamp,
    formatValue,
    makeApiRequest,
} from "../../utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exampleResponse = {
    success: true,
    data: {
        items: [
            {
                o: 128.27328370924414,
                h: 128.6281001340782,
                l: 127.91200927364626,
                c: 127.97284640184616,
                v: 58641.16636665621,
                unixTime: 1726670700,
                address: "So11111111111111111111111111111111111111112",
                type: "15m",
            },
        ],
    },
};

type OHLCVResponse = typeof exampleResponse;

type TimeInterval =
    | "1m"
    | "3m"
    | "5m"
    | "15m"
    | "30m"
    | "1H"
    | "2H"
    | "4H"
    | "6H"
    | "8H"
    | "12H"
    | "1D"
    | "3D"
    | "1W"
    | "1M";

const TIME_INTERVALS: Record<TimeInterval, string[]> = {
    "1m": ["1 minute", "1min", "1m"],
    "3m": ["3 minutes", "3min", "3m"],
    "5m": ["5 minutes", "5min", "5m"],
    "15m": ["15 minutes", "15min", "15m"],
    "30m": ["30 minutes", "30min", "30m"],
    "1H": ["1 hour", "1hr", "1h"],
    "2H": ["2 hours", "2hr", "2h"],
    "4H": ["4 hours", "4hr", "4h"],
    "6H": ["6 hours", "6hr", "6h"],
    "8H": ["8 hours", "8hr", "8h"],
    "12H": ["12 hours", "12hr", "12h"],
    "1D": ["1 day", "daily", "1d"],
    "3D": ["3 days", "3day", "3d"],
    "1W": ["1 week", "weekly", "1w"],
    "1M": ["1 month", "monthly", "1m"],
};

const DEFAULT_INTERVAL: TimeInterval = "1D";

// Constants for keyword matching
const OHLCV_KEYWORDS = [
    "ohlc",
    "ohlcv",
    "candlestick",
    "candle",
    "chart",
    "price history",
    "open close high low",
    "opening price",
    "closing price",
    "historical",
] as const;

// Helper function to check if text contains OHLCV-related keywords
const containsOHLCVKeyword = (text: string): boolean => {
    return OHLCV_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};

const extractTimeInterval = (text: string): TimeInterval => {
    const lowerText = text.toLowerCase();

    // First try exact matches
    for (const [interval, keywords] of Object.entries(TIME_INTERVALS)) {
        if (keywords.some((keyword) => lowerText.includes(keyword))) {
            return interval as TimeInterval;
        }
    }

    // Then try common variations
    if (lowerText.includes("hourly")) return "1H";
    if (lowerText.includes("daily")) return "1D";
    if (lowerText.includes("weekly")) return "1W";
    if (lowerText.includes("monthly")) return "1M";

    return DEFAULT_INTERVAL;
};

const formatVolume = (volume: number): string => {
    if (volume >= 1_000_000_000) {
        return `$${(volume / 1_000_000_000).toFixed(2)}B`;
    }
    if (volume >= 1_000_000) {
        return `$${(volume / 1_000_000).toFixed(2)}M`;
    }
    if (volume >= 1_000) {
        return `$${(volume / 1_000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
};

const getOHLCVData = async (
    apiKey: string,
    contractAddress: string,
    chain: BirdeyeChain,
    interval: TimeInterval = DEFAULT_INTERVAL
): Promise<OHLCVResponse | null> => {
    try {
        const params = new URLSearchParams({
            address: contractAddress,
            interval: interval.toLowerCase(),
            limit: "24", // Get last 24 periods
        });
        const url = `${BASE_URL}/defi/ohlcv?${params.toString()}`;

        elizaLogger.info(
            `Fetching OHLCV data for ${contractAddress} on ${chain} with interval ${interval} from:`,
            url
        );

        return await makeApiRequest<OHLCVResponse>(url, { apiKey, chain });
    } catch (error) {
        if (error instanceof Error) {
            elizaLogger.error("Error fetching OHLCV data:", error.message);
        }
        return null;
    }
};

const formatOHLCVResponse = (
    data: OHLCVResponse,
    tokenMetadata: TokenMetadataResponse | null,
    chain: BirdeyeChain,
    interval: TimeInterval
): string => {
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);

    let tokenInfo = "Unknown Token";
    let tokenLinks = "";

    if (tokenMetadata?.success) {
        const { name, symbol, extensions } = tokenMetadata.data;
        tokenInfo = `${name} (${symbol})`;

        const links: string[] = [];
        if (extensions.website) links.push(`[Website](${extensions.website})`);
        if (extensions.coingecko_id)
            links.push(
                `[CoinGecko](https://www.coingecko.com/en/coins/${extensions.coingecko_id})`
            );
        if (links.length > 0) {
            tokenLinks = `\n📌 More Information: ${links.join(" • ")}`;
        }
    }

    let response = `OHLCV Data for ${tokenInfo} on ${chainName}${tokenLinks}\n`;
    response += `Interval: ${TIME_INTERVALS[interval][0]}\n\n`;

    if (!data.success || !data.data.items || data.data.items.length === 0) {
        return response + "No OHLCV data available for the specified period.";
    }

    const candles = data.data.items;
    const latestCandle = candles[candles.length - 1];

    // Latest candle information
    response += `📊 Latest Candle (${formatTimestamp(latestCandle.unixTime)})\n`;
    response += `• Open: ${formatValue(latestCandle.o)}\n`;
    response += `• High: ${formatValue(latestCandle.h)}\n`;
    response += `• Low: ${formatValue(latestCandle.l)}\n`;
    response += `• Close: ${formatValue(latestCandle.c)}\n`;
    response += `• Volume: ${formatVolume(latestCandle.v)}\n\n`;

    // Price change statistics
    const priceChange = latestCandle.c - latestCandle.o;
    const priceChangePercent = (priceChange / latestCandle.o) * 100;
    const trend = priceChange >= 0 ? "📈" : "📉";

    response += `${trend} Period Change\n`;
    response += `• Price Change: ${formatValue(priceChange)} (${priceChangePercent.toFixed(2)}%)\n\n`;

    // Volume analysis
    const totalVolume = candles.reduce((sum, candle) => sum + candle.v, 0);
    const avgVolume = totalVolume / candles.length;
    const highestVolume = Math.max(...candles.map((c) => c.v));
    const lowestVolume = Math.min(...candles.map((c) => c.v));

    response += `📊 Volume Analysis\n`;
    response += `• Total Volume: ${formatVolume(totalVolume)}\n`;
    response += `• Average Volume: ${formatVolume(avgVolume)}\n`;
    response += `• Highest Volume: ${formatVolume(highestVolume)}\n`;
    response += `• Lowest Volume: ${formatVolume(lowestVolume)}\n\n`;

    // Market analysis
    const volatility =
        ((Math.max(...candles.map((c) => c.h)) -
            Math.min(...candles.map((c) => c.l))) /
            avgVolume) *
        100;
    const volumeLevel =
        latestCandle.v > avgVolume * 1.5
            ? "high"
            : latestCandle.v > avgVolume
              ? "moderate"
              : "low";
    const volatilityLevel =
        volatility > 5 ? "high" : volatility > 2 ? "moderate" : "low";

    response += `📈 Market Analysis\n`;
    response += `• Current volume is ${volumeLevel}\n`;
    response += `• Market volatility is ${volatilityLevel}\n`;
    response += `• Overall trend is ${priceChange >= 0 ? "upward" : "downward"} for this period\n`;

    return response;
};

export const getOHLCVAction: Action = {
    name: "GET_OHLCV",
    similes: [
        "SHOW_OHLCV",
        "VIEW_CANDLESTICK",
        "CHECK_PRICE_CHART",
        "DISPLAY_OHLCV",
        "GET_CANDLESTICK",
        "SHOW_PRICE_CHART",
        "VIEW_PRICE_HISTORY",
        "CHECK_HISTORICAL_PRICES",
        "PRICE_CANDLES",
        "MARKET_CANDLES",
    ],
    description:
        "Retrieve and analyze OHLCV (Open, High, Low, Close, Volume) data for a token, including price movements and volume analysis.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined
    ): Promise<boolean> => {
        return containsOHLCVKeyword(message.content.text);
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
            action: "GET_OHLCV_RESPONSE",
            source: message.content.source,
        };

        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            callbackData.text =
                "I'm unable to fetch the OHLCV data due to missing API credentials.";
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
        const interval = extractTimeInterval(messageText);

        // First fetch token metadata
        const tokenMetadata = await getTokenMetadata(
            apiKey,
            addresses[0].toString(),
            chain as BirdeyeChain
        );

        elizaLogger.info(
            `OHLCV action activated for ${addresses[0]} on ${chain} with ${interval} interval`
        );

        const ohlcvData = await getOHLCVData(
            apiKey,
            addresses[0].toString(),
            chain as BirdeyeChain,
            interval
        );

        if (!ohlcvData) {
            callbackData.text =
                "I apologize, but I couldn't retrieve the OHLCV data at the moment.";
            await callback(callbackData);
            return callbackData;
        }

        callbackData.text = formatOHLCVResponse(
            ohlcvData,
            tokenMetadata,
            chain as BirdeyeChain,
            interval
        );
        await callback(callbackData);
        return callbackData;
    }) as Handler,
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me the daily OHLCV data for token 0x1234... on Ethereum",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's the detailed OHLCV analysis including price movements, volume statistics, and market insights.",
                    action: "GET_OHLCV",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the hourly candlestick data for ABC123... on Solana?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll analyze the hourly OHLCV data and provide you with a comprehensive market overview.",
                    action: "GET_OHLCV",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get me 15-minute candles for token XYZ... on BSC",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll fetch the 15-minute OHLCV data and provide detailed market analysis.",
                    action: "GET_OHLCV",
                },
            },
        ],
    ] as ActionExample[][],
};
