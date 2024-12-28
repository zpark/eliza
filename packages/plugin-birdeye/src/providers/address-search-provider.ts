import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { getTokenMetadata, searchTokens } from "../services";
import {
    extractChain,
    extractContractAddresses,
    extractSymbols,
    formatTokenInfo,
} from "../utils";

/**
 * Searches message text for contract addresses, symbols, or wallet addresses and enriches them with:
 * - Portfolio data if its a wallet address
 * - Token metadata if its a contract address or symbol
 */
export const addressSearchProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string | null> => {
        const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
        if (!apiKey) {
            return null;
        }

        const messageText = message.content.text;

        // STEP 1 - Extract addresses and symbols
        const addresses = extractContractAddresses(messageText);
        const symbols = extractSymbols(messageText);

        if (addresses.length === 0 && symbols.length === 0) return null;

        elizaLogger.info(
            `Searching Birdeye provider for ${addresses.length} addresses and ${symbols.length} symbols`
        );

        // STEP 2 - Search Birdeye services for token matches based on addresses and symbols

        // Search in parallel for all terms
        const searchAddressesForTokenMatch = addresses.map((address) =>
            searchTokens(apiKey, {
                keyword: address.address,
                limit: 1,
            }).then((results) => ({
                searchTerm: address.address,
                address: address.address,
                // find the result that matches the address
                result:
                    results.find((r) => r.address === address.address) || null,
            }))
        );

        // Search in parallel for all terms
        const searchSymbolsForTokenMatch = symbols.map((symbol) =>
            searchTokens(apiKey, {
                keyword: symbol,
                limit: 1,
            }).then((results) => ({
                searchTerm: symbol,
                symbol: results[0]?.symbol || null,
                address: results[0]?.address || null,
                // find the result that matches the symbol
                result: results.find((r) => r.symbol === symbol) || null,
            }))
        );

        const results = await Promise.all([
            ...searchAddressesForTokenMatch,
            ...searchSymbolsForTokenMatch,
        ]);
        const validResults = results.filter((r) => r.result !== null);

        // bail if no valid results
        if (validResults.length === 0) return null;

        // for each result, get the chain from the search term
        const resultsWithChains = validResults.map(
            ({ searchTerm, address }) => ({
                searchTerm,
                address,
                chain: extractChain(address),
            })
        );

        // STEP 3 - get metadata for all valid results and format them. This includes additional token information like social links, logo, etc.
        const resultsWithMetadata = await Promise.all(
            resultsWithChains.map(({ address, chain }) =>
                getTokenMetadata(apiKey, address, chain)
            )
        );

        // STEP 4 - Format all results together
        const completeResults = `The following data is available for the symbols and contract addresses requested: ${validResults
            .map(
                ({ searchTerm, result }, index) =>
                    `Search term "${searchTerm}":\n${formatTokenInfo(result!, resultsWithMetadata[index])}`
            )
            .join("\n\n")}`;

        console.log(completeResults);

        return completeResults;
    },
};
