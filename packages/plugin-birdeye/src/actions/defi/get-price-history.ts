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
    extractAddressesFromString,
    extractChain,
    extractTimeRange,
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
                unixTime: 1726670700,
                value: 127.97284640184616,
            },
            {
                unixTime: 1726671600,
                value: 128.04188346328968,
            },
            {
                unixTime: 1726672500,
                value: 127.40223856228901,
            },
        ],
    },
};

type PriceHistoryResponse = typeof exampleResponse;

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

const TIME_INTERVALS: Record<TimeInterval, string> = {
    "1m": "1 minute",
    "3m": "3 minutes",
    "5m": "5 minutes",
    "15m": "15 minutes",
    "30m": "30 minutes",
    "1H": "1 hour",
    "2H": "2 hours",
    "4H": "4 hours",
    "6H": "6 hours",
    "8H": "8 hours",
    "12H": "12 hours",
    "1D": "1 day",
    "3D": "3 days",
    "1W": "1 week",
    "1M": "1 month",
};

const DEFAULT_INTERVAL: TimeInterval = "1D";

const extractTimeInterval = (text: string): TimeInterval => {
    // First try to match exact interval codes
    const intervalMatch = text.match(
        /\b(1m|3m|5m|15m|30m|1H|2H|4H|6H|8H|12H|1D|3D|1W|1M)\b/i
    );
    if (intervalMatch) {
        return intervalMatch[1].toUpperCase() as TimeInterval;
    }

    // Then try to match written intervals
    const lowerText = text.toLowerCase();
    for (const [interval, description] of Object.entries(TIME_INTERVALS)) {
        if (lowerText.includes(description.toLowerCase())) {
            return interval as TimeInterval;
        }
    }

    // Common variations
    if (lowerText.includes("hourly")) return "1H";
    if (lowerText.includes("daily")) return "1D";
    if (lowerText.includes("weekly")) return "1W";
    if (lowerText.includes("monthly")) return "1M";

    return DEFAULT_INTERVAL;
};

// Constants for keyword matching
const PRICE_HISTORY_KEYWORDS = [
    "price history",
    "historical price",
    "price chart",
    "price trend",
    "price movement",
    "price changes",
    "price over time",
    "price timeline",
    "price performance",
    "price data",
    "historical data",
    "price analysis",
    "price tracking",
    "price evolution",
] as const;

// Helper function to check if text contains price history related keywords
const containsPriceHistoryKeyword = (text: string): boolean => {
    return PRICE_HISTORY_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};

const getPriceHistory = async (
    apiKey: string,
    contractAddress: string,
    startTime: number,
    endTime: number,
    chain: BirdeyeChain,
    interval: TimeInterval = DEFAULT_INTERVAL
): Promise<PriceHistoryResponse | null> => {
    try {
        const params = new URLSearchParams({
            address: contractAddress,
            time_from: startTime.toString(),
            time_to: endTime.toString(),
            interval: interval.toLowerCase(),
        });
        const url = `${BASE_URL}/defi/price_history_unix?${params.toString()}`;

        elizaLogger.info(
            `Fetching price history for token ${contractAddress} from ${new Date(
                startTime * 1000
            ).toLocaleString()} to ${new Date(
                endTime * 1000
            ).toLocaleString()} on ${chain} with ${TIME_INTERVALS[interval]} interval from:`,
            url
        );

        return await makeApiRequest<PriceHistoryResponse>(url, {
            apiKey,
            chain,
        });
    } catch (error) {
        if (error instanceof Error) {
            elizaLogger.error("Error fetching price history:", error.message);
        }
        return null;
    }
};

const formatPriceHistoryResponse = (
    data: PriceHistoryResponse,
    tokenMetadata: TokenMetadataResponse | null,
    timeRange: { start: number; end: number },
    chain: BirdeyeChain,
    interval: TimeInterval
): string => {
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);
    const startDate = formatTimestamp(timeRange.start);
    const endDate = formatTimestamp(timeRange.end);

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

    let response = `Price History for ${tokenInfo} on ${chainName}${tokenLinks}\n`;
    response += `Period: ${startDate} to ${endDate} (${TIME_INTERVALS[interval]} intervals)\n\n`;

    if (!data.success || !data.data.items || data.data.items.length === 0) {
        return response + "No price data found for this period.";
    }

    // Calculate summary statistics
    const prices = data.data.items.map((d) => d.value);
    const startPrice = data.data.items[0].value;
    const endPrice = data.data.items[data.data.items.length - 1].value;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const volatility = ((highestPrice - lowestPrice) / averagePrice) * 100;

    response += `📊 Summary\n`;
    response += `• Start Price: ${formatValue(startPrice)}\n`;
    response += `• End Price: ${formatValue(endPrice)}\n`;
    response += `• Price Change: ${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%\n`;
    response += `• Highest Price: ${formatValue(highestPrice)}\n`;
    response += `• Lowest Price: ${formatValue(lowestPrice)}\n`;
    response += `• Average Price: ${formatValue(averagePrice)}\n`;
    response += `• Volatility: ${volatility.toFixed(2)}%\n\n`;

    // Add trend analysis
    const trendStrength = Math.abs(priceChange);
    let trendAnalysis = "";
    if (trendStrength < 1) {
        trendAnalysis = "Price has remained relatively stable";
    } else if (trendStrength < 5) {
        trendAnalysis =
            priceChange > 0
                ? "Price shows slight upward movement"
                : "Price shows slight downward movement";
    } else if (trendStrength < 10) {
        trendAnalysis =
            priceChange > 0
                ? "Price demonstrates moderate upward trend"
                : "Price demonstrates moderate downward trend";
    } else {
        trendAnalysis =
            priceChange > 0
                ? "Price exhibits strong upward momentum"
                : "Price exhibits strong downward momentum";
    }

    response += `📈 Trend Analysis\n`;
    response += `• ${trendAnalysis}\n`;
    response += `• Volatility is ${volatility < 10 ? "low" : volatility < 25 ? "moderate" : "high"}\n\n`;

    // Show key price points
    response += `🔑 Key Price Points\n`;
    const keyPoints = [
        {
            label: "Start",
            price: data.data.items[0].value,
            timestamp: data.data.items[0].unixTime,
        },
        {
            label: "High",
            price: highestPrice,
            timestamp: data.data.items[prices.indexOf(highestPrice)].unixTime,
        },
        {
            label: "Low",
            price: lowestPrice,
            timestamp: data.data.items[prices.indexOf(lowestPrice)].unixTime,
        },
        {
            label: "End",
            price: data.data.items[data.data.items.length - 1].value,
            timestamp: data.data.items[data.data.items.length - 1].unixTime,
        },
    ];

    keyPoints.forEach((point) => {
        response += `• ${point.label}: ${formatValue(point.price)} (${formatTimestamp(point.timestamp)})\n`;
    });

    return response;
};

export const getPriceHistoryAction: Action = {
    name: "GET_PRICE_HISTORY",
    similes: [
        "SHOW_PRICE_HISTORY",
        "VIEW_PRICE_HISTORY",
        "CHECK_PRICE_HISTORY",
        "DISPLAY_PRICE_HISTORY",
        "ANALYZE_PRICE_HISTORY",
        "GET_HISTORICAL_PRICES",
        "SHOW_HISTORICAL_PRICES",
        "VIEW_PRICE_TREND",
        "CHECK_PRICE_TREND",
        "ANALYZE_PRICE_TREND",
        "PRICE_PERFORMANCE",
        "TOKEN_PERFORMANCE",
    ],
    description:
        "Retrieve and analyze historical price data for a token, including price changes, trends, and key statistics over a specified time period.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined
    ): Promise<boolean> => {
        return containsPriceHistoryKeyword(message.content.text);
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
            action: "GET_PRICE_HISTORY_RESPONSE",
            source: message.content.source,
        };

        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            callbackData.text =
                "I'm unable to fetch the price history due to missing API credentials.";
            await callback(callbackData);
            return callbackData;
        }

        const messageText = message.content.text;
        const addresses = extractAddressesFromString(messageText);
        if (addresses.length === 0) {
            callbackData.text =
                "I couldn't find a valid token address in your message.";
            await callback(callbackData);
            return callbackData;
        }

        const chain = extractChain(messageText);
        const timeRange = extractTimeRange(messageText);
        const interval = extractTimeInterval(messageText);

        // First fetch token metadata
        const tokenMetadata = await getTokenMetadata(
            apiKey,
            addresses[0].toString(),
            chain as BirdeyeChain
        );

        elizaLogger.info(
            `PRICE HISTORY action activated for token ${addresses[0]} from ${new Date(
                timeRange.start * 1000
            ).toLocaleString()} to ${new Date(
                timeRange.end * 1000
            ).toLocaleString()} on ${chain} with ${TIME_INTERVALS[interval]} interval`
        );

        const priceData = await getPriceHistory(
            apiKey,
            addresses[0].toString(),
            timeRange.start,
            timeRange.end,
            chain as BirdeyeChain,
            interval
        );

        if (!priceData) {
            callbackData.text =
                "I apologize, but I couldn't retrieve the price history data at the moment.";
            await callback(callbackData);
            return callbackData;
        }

        callbackData.text = formatPriceHistoryResponse(
            priceData,
            tokenMetadata,
            timeRange,
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
                    text: "Show me the daily price history for token 0x1234... on Ethereum for the last week",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's the detailed daily price history analysis for the token, including price changes, trends, and key statistics over the specified period.",
                    action: "GET_PRICE_HISTORY",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the hourly price trend for ABC123... on Solana?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll analyze the hourly price history and provide you with a comprehensive overview of the token's performance.",
                    action: "GET_PRICE_HISTORY",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get 5-minute interval price data for token XYZ... on BSC",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll fetch the price history with 5-minute intervals and analyze the detailed price movements.",
                    action: "GET_PRICE_HISTORY",
                },
            },
        ],
    ] as ActionExample[][],
};
