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
import { BirdeyeChain } from "../../types/shared";
import {
    CHAIN_ALIASES,
    CHAIN_KEYWORDS,
    extractAddressesFromString,
    extractChain,
} from "../../utils";

// Constants for keyword matching
const METADATA_KEYWORDS = [
    "metadata",
    "token info",
    "token information",
    "token details",
    "token data",
    "token description",
    "token profile",
    "token overview",
    "token stats",
    "token statistics",
    "token social",
    "token links",
    "token website",
    "token socials",
] as const;

// Helper function to check if text contains metadata-related keywords
const containsMetadataKeyword = (text: string): boolean => {
    return METADATA_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};

export const getTokenMetadataAction: Action = {
    name: "GET_TOKEN_METADATA",
    similes: [
        "SHOW_TOKEN_INFO",
        "VIEW_TOKEN_DETAILS",
        "CHECK_TOKEN_METADATA",
        "DISPLAY_TOKEN_INFO",
        "GET_TOKEN_DETAILS",
        "TOKEN_INFORMATION",
        "TOKEN_PROFILE",
        "TOKEN_OVERVIEW",
        "TOKEN_SOCIAL_LINKS",
        "TOKEN_STATISTICS",
        "TOKEN_DESCRIPTION",
    ],
    description:
        "Retrieve and display comprehensive token metadata including basic information, description, social links, and other relevant details.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined
    ): Promise<boolean> => {
        return containsMetadataKeyword(message.content.text);
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
            action: "GET_TOKEN_METADATA_RESPONSE",
            source: message.content.source,
        };

        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            callbackData.text =
                "I'm unable to fetch the token metadata due to missing API credentials.";
            await callback(callbackData);
            return callbackData;
        }

        const messageText = message.content.text;
        const addresses = extractAddressesFromString(messageText);
        const chain = extractChain(messageText);

        // Check if a specific chain was mentioned (including aliases)
        const normalizedText = messageText.toLowerCase();
        const isChainMentioned =
            CHAIN_KEYWORDS.some((keyword) =>
                normalizedText.includes(keyword.toLowerCase())
            ) ||
            Object.keys(CHAIN_ALIASES).some((alias) =>
                normalizedText.includes(alias.toLowerCase())
            );

        if (addresses.length === 0) {
            callbackData.text = isChainMentioned
                ? `I couldn't find a valid token address for ${chain} chain in your message. ${chain} addresses should match the format: ${getChainAddressFormat(
                      chain as BirdeyeChain
                  )}`
                : "I couldn't find a valid token address in your message.";
            await callback(callbackData);
            return callbackData;
        }

        await callback(callbackData);
        return callbackData;
    }) as Handler,
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me the token information for 0x1234... on Ethereum",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's the detailed token metadata including basic information, social links, and other relevant details.",
                    action: "GET_TOKEN_METADATA",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What are the token details for ABC123... on Solana?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll fetch and display the comprehensive token profile with all available information.",
                    action: "GET_TOKEN_METADATA",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get me the social links and description for token XYZ... on BSC",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll retrieve the token's metadata including its social media links and description.",
                    action: "GET_TOKEN_METADATA",
                },
            },
        ],
    ] as ActionExample[][],
};

const getChainAddressFormat = (chain: BirdeyeChain): string => {
    switch (chain) {
        case "solana":
            return "Base58 string (32-44 characters)";
        case "sui":
            return "0x followed by 64 hexadecimal characters, optionally followed by ::module::type";
        case "ethereum":
        case "arbitrum":
        case "avalanche":
        case "bsc":
        case "optimism":
        case "polygon":
        case "base":
        case "zksync":
            return "0x followed by 40 hexadecimal characters";
        default:
            return "unknown format";
    }
};
