import {
    Action,
    ActionExample,
    elizaLogger,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { BirdeyeProvider } from "../birdeye";
import { waitFor } from "../utils";

export const testAllEndpointsAction = {
    name: "BIRDEYE_TEST_ALL_ENDPOINTS",
    similes: [],
    description: "Test all Birdeye endpoints with sample data",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: any
    ) => {
        try {
            elizaLogger.info("Testing all endpoints");

            await waitFor(1000);

            const birdeyeProvider = new BirdeyeProvider(runtime.cacheManager);

            // Sample data for testing
            const sampleParams = {
                token: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                address: "MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa",
                network: "solana",
                headers: { "x-chain": "solana" },
                list_address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                address_type: "token",
                type: "1D",
                unixtime: 1234567890,
                base_address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                quote_address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                time_to: 1672531199, // Unix timestamp
                meme_platform_enabled: true,
                time_frame: "1D",
                sort_type: undefined,
                sort_by: undefined,
                list_addresses: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                wallet: "MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa",
                token_address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                pair: "samplePair",
            };

            // Test each fetch function
            await birdeyeProvider.fetchDefiSupportedNetworks();
            elizaLogger.success("fetchDefiSupportedNetworks: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPrice({ ...sampleParams });
            elizaLogger.success("fetchDefiPrice: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceMultiple({ ...sampleParams });
            elizaLogger.success("fetchDefiPriceMultiple: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceMultiple_POST({
                ...sampleParams,
            });
            elizaLogger.success("fetchDefiPriceMultiple_POST: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceHistorical({
                ...sampleParams,
                address_type: "token",
                type: "1D",
            });
            elizaLogger.success("fetchDefiPriceHistorical: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceHistoricalByUnixTime({
                ...sampleParams,
            });
            elizaLogger.success("fetchDefiPriceHistoricalByUnixTime: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiTradesToken({ ...sampleParams });
            elizaLogger.success("fetchDefiTradesToken: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiTradesPair({ ...sampleParams });
            elizaLogger.success("fetchDefiTradesPair: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiTradesTokenSeekByTime({
                ...sampleParams,
            });
            elizaLogger.success("fetchDefiTradesTokenSeekByTime: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiTradesPairSeekByTime({
                ...sampleParams,
            });
            elizaLogger.success("fetchDefiTradesPairSeekByTime: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiOHLCV({
                ...sampleParams,
                type: "1D",
            });
            elizaLogger.success("fetchDefiOHLCV: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiOHLCVPair({
                ...sampleParams,
                type: "1D",
            });
            elizaLogger.success("fetchDefiOHLCVPair: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiOHLCVBaseQuote({
                ...sampleParams,
                type: "1D",
            });
            elizaLogger.success("fetchDefiOHLCVBaseQuote: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceVolume({
                ...sampleParams,
                type: "1D",
            });
            elizaLogger.success("fetchDefiPriceVolume: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchDefiPriceVolumeMulti_POST({
                ...sampleParams,
                type: "1D",
            });
            elizaLogger.success("fetchDefiPriceVolumeMulti_POST: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenList({
                ...sampleParams,
                sort_by: "mc",
                sort_type: "desc",
            });
            elizaLogger.success("fetchTokenList: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenSecurityByAddress({
                ...sampleParams,
            });
            elizaLogger.success("fetchTokenSecurityByAddress: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenOverview({ ...sampleParams });
            elizaLogger.success("fetchTokenOverview: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenCreationInfo({ ...sampleParams });
            elizaLogger.success("fetchTokenCreationInfo: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenTrending({
                ...sampleParams,
                sort_by: "volume24hUSD",
                sort_type: "desc",
            });
            elizaLogger.success("fetchTokenTrending: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenListV2_POST({});
            elizaLogger.success("fetchTokenListV2_POST: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenNewListing({ ...sampleParams });
            elizaLogger.success("fetchTokenNewListing: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenTopTraders({
                ...sampleParams,
                time_frame: "12H",
                sort_type: "asc",
                sort_by: "volume",
            });
            elizaLogger.success("fetchTokenTopTraders: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenAllMarketsList({
                ...sampleParams,
                time_frame: "12H",
                sort_type: "asc",
                sort_by: "volume24h",
            });
            elizaLogger.success("fetchTokenAllMarketsList: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenMetadataSingle({ ...sampleParams });
            elizaLogger.success("fetchTokenMetadataSingle: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenMetadataMulti({ ...sampleParams });
            elizaLogger.success("fetchTokenMetadataMulti: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenMarketData({ ...sampleParams });
            elizaLogger.success("fetchTokenMarketData: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenTradeDataSingle({
                ...sampleParams,
            });
            elizaLogger.success("fetchTokenTradeDataSingle: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenTradeDataMultiple({
                ...sampleParams,
            });
            elizaLogger.success("fetchTokenTradeDataMultiple: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenHolders({ ...sampleParams });
            elizaLogger.success("fetchTokenHolders: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTokenMintBurn({
                ...sampleParams,
                sort_by: "block_time",
                sort_type: "desc",
                type: "all",
            });
            elizaLogger.success("fetchTokenMintBurn: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletSupportedNetworks();
            elizaLogger.success("fetchWalletSupportedNetworks: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletPortfolio({ ...sampleParams });
            elizaLogger.success("fetchWalletPortfolio: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletPortfolioMultichain({
                ...sampleParams,
            });
            elizaLogger.success("fetchWalletPortfolioMultichain: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletTokenBalance({ ...sampleParams });
            elizaLogger.success("fetchWalletTokenBalance: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletTransactionHistory({
                ...sampleParams,
            });
            elizaLogger.success("fetchWalletTransactionHistory: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchWalletTransactionHistoryMultichain({
                ...sampleParams,
            });
            elizaLogger.success(
                "fetchWalletTransactionHistoryMultichain: SUCCESS!"
            );
            await waitFor(500);

            await birdeyeProvider.fetchWalletTransactionSimulate_POST({
                ...sampleParams,
            });
            elizaLogger.success(
                "fetchWalletTransactionSimulate_POST: SUCCESS!"
            );
            await waitFor(500);

            await birdeyeProvider.fetchTraderGainersLosers({
                ...sampleParams,
                type: "today",
            });
            elizaLogger.success("fetchTraderGainersLosers: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchTraderTransactionsSeek({
                ...sampleParams,
            });
            elizaLogger.success("fetchTraderTransactionsSeek: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchPairOverviewSingle({ ...sampleParams });
            elizaLogger.success("fetchPairOverviewSingle: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchMultiPairOverview({ ...sampleParams });
            elizaLogger.success("fetchMultiPairOverview: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchPairOverviewMultiple({
                ...sampleParams,
            });
            elizaLogger.success("fetchPairOverviewMultiple: SUCCESS!");
            await waitFor(500);

            await birdeyeProvider.fetchSearchTokenMarketData({
                ...sampleParams,
            });
            elizaLogger.success("fetchSearchTokenMarketData: SUCCESS!");
            await waitFor(500);

            elizaLogger.info("All endpoints tested successfully");
            callback?.({ text: "All endpoints tested successfully" });
            return true;
        } catch (error) {
            console.error("Error in testAllEndpointsAction:", error.message);
            callback?.({ text: `Error: ${error.message}` });
            return false;
        }
    },
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        // only run if explicitly triggered by user
        return message.content.text.includes("BIRDEYE_TEST_ALL_ENDPOINTS");
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "I want you to BIRDEYE_TEST_ALL_ENDPOINTS",
                    action: "BIRDEYE_TEST_ALL_ENDPOINTS",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
