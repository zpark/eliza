import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { extractAddressesFromString } from "../utils";

/**
 * Wallet portfolio provider that queries Birdeye API for a any potential wallet addresses the message.
 * When a wallet address is set, this provider fetches portfolio data to give the agent
 * context about the user's top holdings when responding to queries.
 */
export const walletPortfolioProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            const provider = new BirdeyeProvider(runtime.cacheManager);

            const messageText = message.content.text;

            // STEP 1 - Extract addresses and symbols
            const addresses = extractAddressesFromString(messageText);

            if (addresses.length === 0) return null;

            elizaLogger.info(
                `Searching Birdeye provider for ${addresses.length} wallet addresses`
            );

            // STEP 2 - Search Birdeye services for wallet portfolio data
            const searchAddressesForTokenMatch = addresses.map((address) =>
                provider.fetchSearchWallets({
                    wallet: address.address,
                    chain: address.chain,
                })
            );

            // STEP 3 - Format the results together
            const results = await Promise.all(searchAddressesForTokenMatch);
            const validResults = results.filter((r) => r !== null);

            elizaLogger.info(
                `Found ${validResults.length} valid results for ${addresses.length} addresses`
            );

            if (validResults.length === 0) return null;

            // Format portfolio data into readable text
            const portfolioText = validResults
                .map((wallet, index) => {
                    const tokens = wallet.data.items.slice(0, 5) || [];
                    const tokenList = tokens
                        .map(
                            (token) =>
                                `${token.symbol}: $${token.valueUsd?.toLocaleString()}`
                        )
                        .join(", ");

                    return `Wallet ${addresses[index].address} holds: ${tokenList}`;
                })
                .join("\n");

            return portfolioText;
        } catch (error) {
            console.error("Error fetching wallet portfolio data:", error);
            return "Unable to fetch wallet portfolio information. Please try again later.";
        }
    },
};
