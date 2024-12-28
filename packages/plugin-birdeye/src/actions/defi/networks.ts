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
import { BASE_URL, makeApiRequest } from "../../utils.ts";
import { containsNetworkKeyword, NetworksResponse } from "./networks.utils.ts";

export const getSupportedNetworksAction: Action = {
    name: "GET_SUPPORTED_NETWORKS",
    similes: [
        "LIST_NETWORKS",
        "SHOW_NETWORKS",
        "AVAILABLE_NETWORKS",
        "SUPPORTED_CHAINS",
        "LIST_CHAINS",
        "SHOW_CHAINS",
        "NETWORK_SUPPORT",
        "CHAIN_SUPPORT",
    ],
    description:
        "Retrieve and display the list of networks supported by the Birdeye API for token information, swaps, prices, and market data.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State | undefined
    ): Promise<boolean> => {
        return containsNetworkKeyword(message.content.text);
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
            action: "GET_SUPPORTED_NETWORKS_RESPONSE",
            source: message.content.source,
        };

        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            elizaLogger.error("BIRDEYE_API_KEY not found in runtime settings");
            callbackData.text =
                "I'm unable to fetch the supported networks due to missing API credentials.";
            await callback(callbackData);
            return callbackData;
        }

        elizaLogger.info("Fetching supported networks");
        const url = `${BASE_URL}/defi/networks`;

        const networksData = await makeApiRequest<NetworksResponse>(url, {
            apiKey,
        });

        if (!networksData) {
            callbackData.text =
                "I apologize, but I couldn't retrieve the list of supported networks at the moment.";
            await callback(callbackData);
            return callbackData;
        }

        callbackData.text = `Currently supported networks are: ${networksData.data.join(", ")}`;
        await callback(callbackData);
        return callbackData;
    }) as Handler,
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What networks are supported?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here are the currently supported networks: solana, ethereum, arbitrum, avalanche, bsc, optimism, polygon, base, zksync, sui",
                    action: "GET_SUPPORTED_NETWORKS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me the available chains",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "The available chains are: solana, ethereum, arbitrum, avalanche, bsc, optimism, polygon, base, zksync, sui",
                    action: "GET_SUPPORTED_NETWORKS",
                },
            },
        ],
    ] as ActionExample[][],
};
