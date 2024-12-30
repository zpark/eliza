import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import {
    extractAddressesFromString,
    extractChain,
    formatTokenInfo,
} from "../utils";

/**
 * Searches message text for ALL contract addresses, symbols, or wallet addresses and enriches them with:
 * - Portfolio data if its a wallet address
 * - Token metadata if its a contract address or symbol
 */
export const addressSearchProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string | null> => {
        const provider = new BirdeyeProvider(runtime.cacheManager);

        const messageText = message.content.text;

        // STEP 1 - Extract addresses and symbols
        const addresses = extractAddressesFromString(messageText);
        if (addresses.length === 0) return null;

        elizaLogger.info(
            `Searching Birdeye provider for ${addresses.length} token addresses`
        );

        // STEP 2 - Search Birdeye services for token matches based on addresses and symbols
        const searchAddressesForTokenMatch = addresses.map((address) =>
            provider
                .fetchSearchTokens({
                    keyword: address.address,
                    limit: 1,
                })
                .then((results) => ({
                    searchTerm: address.address,
                    address: address.address,
                    result: results[0] || null,
                }))
        );

        const results = await Promise.all(searchAddressesForTokenMatch);
        const validResults = results.filter((r) => r.result !== null);

        elizaLogger.info(
            `Found ${validResults.length} valid results for ${addresses.length} addresses`
        );

        // bail if no valid results
        if (validResults.length === 0) return null;

        // STEP 3 - get metadata for all valid results and format them. This includes additional token information like social links, logo, etc.
        const resultsWithMetadata = await Promise.all(
            validResults.map(({ address }) =>
                provider.fetchTokenMetadata(address, extractChain(address))
            )
        );

        // STEP 4 - Format all results together
        const completeResults = `The following data is available for the addresses requested: ${validResults
            .map(
                ({ searchTerm, result }, index) =>
                    `Address "${searchTerm}":\n${formatTokenInfo(result!, resultsWithMetadata[index])}`
            )
            .join("\n\n")}`;

        return completeResults;
    },
};
