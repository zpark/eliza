import { Plugin } from "@elizaos/core";
import { getOHLCVAction } from "./actions/defi/get-ohlcv";
import { getPriceHistoryAction } from "./actions/defi/get-price-history";
import { getSupportedNetworksAction } from "./actions/defi/get-supported-networks";
import { getTokenMetadataAction } from "./actions/defi/get-token-metadata";
import { getTokenTradesAction } from "./actions/defi/get-token-trades";

export const birdeyePlugin: Plugin = {
    name: "birdeye",
    description: "Birdeye Plugin for token data and analytics",
    actions: [
        getSupportedNetworksAction,
        getTokenMetadataAction,
        getPriceHistoryAction,
        getOHLCVAction,
        getTokenTradesAction,
    ],
    evaluators: [],
    providers: [
        // networksProvider,
        // // DeFi providers
        // priceProvider,
        // priceMultipleProvider,
        // ohlcvProvider,
        // priceVolumeProvider,
        // // Pair providers
        // pairOverviewProvider,
        // // Search providers
        // tokenMarketDataProvider,
        // // Token providers
        // tokenOverviewProvider,
        // tokenSecurityProvider,
        // tokenListProvider,
        // trendingTokensProvider,
        // tokenCreationProvider,
        // tokenTradeProvider,
        // // Trader providers
        // gainersLosersProvider,
        // tradesSeekProvider,
        // // Wallet providers
        // transactionHistoryProvider,
        // walletPortfolioProvider,
    ],
};

export default birdeyePlugin;
