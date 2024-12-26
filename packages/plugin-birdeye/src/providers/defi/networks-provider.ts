import {
    IAgentRuntime,
    Memory,
    Provider,
    State,
    elizaLogger,
} from "@elizaos/core";
import { BASE_URL, makeApiRequest } from "../utils";

// Constants
const NETWORK_KEYWORDS = [
    "supported networks",
    "available networks",
    "supported chains",
    "available chains",
    "which networks",
    "which chains",
    "list networks",
    "list chains",
    "show networks",
    "show chains",
    "network support",
    "chain support",
] as const;

// Helper functions
const containsNetworkKeyword = (text: string): boolean => {
    return NETWORK_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};

// use sample response to simplify type generation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sampleResponse = {
    data: [
        "solana",
        "ethereum",
        "arbitrum",
        "avalanche",
        "bsc",
        "optimism",
        "polygon",
        "base",
        "zksync",
        "sui",
    ],
    success: true,
};

export const networksProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string | null> => {
        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            return null;
        }

        const messageText = message.content.text;

        if (!containsNetworkKeyword(messageText)) {
            return null;
        }

        elizaLogger.info("NETWORKS provider activated");

        const url = `${BASE_URL}/defi/networks`;

        elizaLogger.info("Fetching supported networks from:", url);

        const networksData = await makeApiRequest<typeof sampleResponse>(url, {
            apiKey,
        });

        console.log(JSON.stringify(networksData, null, 2));

        if (!networksData) {
            return null;
        }

        return `Currently supported networks for information about tokens, swaps, prices, gainers and losers are: ${networksData.data.join(", ")}`;
    },
};
