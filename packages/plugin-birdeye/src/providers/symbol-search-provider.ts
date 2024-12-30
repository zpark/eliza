import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { extractChain, extractSymbols, formatTokenInfo } from "../utils";

/**
 * Searches message text for ALL token symbols and then enriches them with the basic token stats and metadata from Birdeye
 */
export const symbolSearchProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string | null> => {
        const provider = new BirdeyeProvider(runtime.cacheManager);

        const messageText = message.content.text;

        // STEP 1 - Extract symbols
        const symbols = extractSymbols(messageText);

        if (symbols.length === 0) return null;

        elizaLogger.info(
            `Searching Birdeye provider for ${symbols.length} symbols`
        );

        // STEP 2 - Search Birdeye services for token matches based on symbols
        const searchTokenResponses = symbols.map((symbol) =>
            provider.fetchSearchTokens({
                keyword: symbol,
                limit: 1,
            })
        );

        const results = await Promise.all(searchTokenResponses);
        const validResults = results.map(
            (r, index) =>
                r.data.items.find(
                    (item) =>
                        item.type === "token" &&
                        item.result[0].symbol.toLowerCase() ===
                            symbols[index].toLowerCase()
                )?.result[0]
        );

        elizaLogger.info(
            `Found ${validResults.length} valid results for ${symbols.length} symbols`
        );

        console.log(JSON.stringify(validResults, null, 2));

        // bail if no valid results
        if (validResults.length === 0) return null;

        // for each result, get the chain from the search term
        const resultsWithChains = validResults.map((result) => ({
            symbol: result.symbol,
            address: result.address,
            chain: extractChain(result.address),
        }));

        // STEP 3 - get metadata for all valid results and format them. This includes additional token information like social links, logo, etc.
        const resultsWithMetadata = await Promise.all(
            resultsWithChains.map(({ address, chain }) =>
                provider.fetchTokenMetadata(address, chain)
            )
        );

        // STEP 4 - Format all results together
        const completeResults = `The following data is available for the symbols requested: ${validResults
            .map(
                (result, index) =>
                    `Search term "${result.symbol}":\n${formatTokenInfo(result!, resultsWithMetadata[index])}`
            )
            .join("\n\n")}`;

        console.log(completeResults);

        return completeResults;
    },
};
