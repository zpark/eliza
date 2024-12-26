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
    CHAIN_KEYWORDS,
    extractChain,
    extractContractAddresses,
    makeApiRequest,
} from "../../providers/utils";

// Define explicit interface instead of using typeof
export interface TokenMetadataResponse {
    data: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        extensions: {
            coingecko_id?: string;
            website?: string;
            twitter?: string;
            discord?: string;
            medium?: string;
        };
        logo_uri?: string;
    };
    success: boolean;
}

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

export const getTokenMetadata = async (
    apiKey: string,
    contractAddress: string,
    chain: Chain
): Promise<TokenMetadataResponse | null> => {
    try {
        // Validate address format based on chain
        const isValidAddress = (() => {
            switch (chain) {
                case "solana":
                    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
                        contractAddress
                    );
                case "sui":
                    return /^0x[a-fA-F0-9]{64}$/i.test(contractAddress);
                case "ethereum":
                case "arbitrum":
                case "avalanche":
                case "bsc":
                case "optimism":
                case "polygon":
                case "base":
                case "zksync":
                    return /^0x[a-fA-F0-9]{40}$/i.test(contractAddress);
                default:
                    return false;
            }
        })();

        if (!isValidAddress) {
            elizaLogger.error(
                `Invalid address format for ${chain}: ${contractAddress}`
            );
            return null;
        }

        const params = new URLSearchParams({
            address: contractAddress,
        });
        const url = `${BASE_URL}/defi/v3/token/meta-data/single?${params.toString()}`;

        elizaLogger.info(
            `Fetching token metadata for ${contractAddress} on ${chain} from:`,
            url
        );

        return await makeApiRequest<TokenMetadataResponse>(url, {
            apiKey,
            chain,
        });
    } catch (error) {
        if (error instanceof Error) {
            elizaLogger.error("Error fetching token metadata:", error.message);
        }
        return null;
    }
};

const formatSocialLinks = (data: TokenMetadataResponse["data"]): string => {
    const links = [];
    const { extensions } = data;

    if (!extensions) {
        return "No social links available";
    }

    if (extensions.website) {
        links.push(`🌐 [Website](${extensions.website})`);
    }
    if (extensions.twitter) {
        links.push(`🐦 [Twitter](${extensions.twitter})`);
    }
    if (extensions.discord) {
        links.push(`💬 [Discord](${extensions.discord})`);
    }
    if (extensions.medium) {
        links.push(`📝 [Medium](${extensions.medium})`);
    }
    if (extensions.coingecko_id) {
        links.push(
            `🦎 [CoinGecko](https://www.coingecko.com/en/coins/${extensions.coingecko_id})`
        );
    }

    return links.length > 0 ? links.join("\n") : "No social links available";
};

const formatMetadataResponse = (
    data: TokenMetadataResponse,
    chain: Chain
): string => {
    const tokenData = data.data;
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);
    const chainExplorer = (() => {
        switch (chain) {
            case "solana":
                return `https://solscan.io/token/${tokenData.address}`;
            case "ethereum":
                return `https://etherscan.io/token/${tokenData.address}`;
            case "arbitrum":
                return `https://arbiscan.io/token/${tokenData.address}`;
            case "avalanche":
                return `https://snowtrace.io/token/${tokenData.address}`;
            case "bsc":
                return `https://bscscan.com/token/${tokenData.address}`;
            case "optimism":
                return `https://optimistic.etherscan.io/token/${tokenData.address}`;
            case "polygon":
                return `https://polygonscan.com/token/${tokenData.address}`;
            case "base":
                return `https://basescan.org/token/${tokenData.address}`;
            case "zksync":
                return `https://explorer.zksync.io/address/${tokenData.address}`;
            case "sui":
                return `https://suiscan.xyz/mainnet/object/${tokenData.address}`;
            default:
                return null;
        }
    })();

    let response = `Token Metadata for ${tokenData.name} (${tokenData.symbol}) on ${chainName}\n\n`;

    // Basic Information
    response += "📝 Basic Information\n";
    response += `• Name: ${tokenData.name}\n`;
    response += `• Symbol: ${tokenData.symbol}\n`;
    response += `• Address: ${tokenData.address}\n`;
    response += `• Decimals: ${tokenData.decimals}\n`;
    if (chainExplorer) {
        response += `• Explorer: [View on ${chainName} Explorer](${chainExplorer})\n`;
    }

    // Social Links
    response += "\n🔗 Social Links & Extensions\n";
    response += formatSocialLinks(tokenData) + "\n";

    // Logo
    if (tokenData.logo_uri) {
        response += "\n🖼️ Logo\n";
        response += tokenData.logo_uri;
    }

    return response;
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
        const addresses = extractContractAddresses(messageText);
        const chain = extractChain(messageText);

        // Check if a specific chain was mentioned
        const isChainMentioned = CHAIN_KEYWORDS.some((keyword) =>
            messageText.toLowerCase().includes(keyword.toLowerCase())
        );

        if (addresses.length === 0) {
            callbackData.text = isChainMentioned
                ? `I couldn't find a valid token address for ${chain} chain in your message. ${chain} addresses should match the format: ${getChainAddressFormat(chain)}`
                : "I couldn't find a valid token address in your message.";
            await callback(callbackData);
            return callbackData;
        }

        // Validate that the address matches the specified chain format
        const isValidForChain = (() => {
            switch (chain) {
                case "solana":
                    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addresses[0]);
                case "sui":
                    return (
                        /^0x[a-fA-F0-9]{64}$/i.test(addresses[0]) ||
                        /^0x[a-fA-F0-9]{64}::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+$/i.test(
                            addresses[0]
                        )
                    );
                case "ethereum":
                case "arbitrum":
                case "avalanche":
                case "bsc":
                case "optimism":
                case "polygon":
                case "base":
                case "zksync":
                    return /^0x[a-fA-F0-9]{40}$/i.test(addresses[0]);
                default:
                    return false;
            }
        })();

        if (!isValidForChain && isChainMentioned) {
            callbackData.text = `The provided address doesn't match the format for ${chain} chain. ${chain} addresses should match the format: ${getChainAddressFormat(chain)}`;
            await callback(callbackData);
            return callbackData;
        }

        elizaLogger.info(
            `TOKEN METADATA action activated for ${addresses[0]} on ${chain}`
        );

        const metadataData = await getTokenMetadata(
            apiKey,
            addresses[0],
            chain
        );

        if (!metadataData) {
            callbackData.text =
                "I apologize, but I couldn't retrieve the token metadata at the moment.";
            await callback(callbackData);
            return callbackData;
        }

        callbackData.text = formatMetadataResponse(metadataData, chain);
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

const getChainAddressFormat = (chain: Chain): string => {
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
