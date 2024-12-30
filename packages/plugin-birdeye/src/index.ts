import { Plugin } from "@elizaos/core";
import { getSupportedNetworksAction } from "./actions/defi/networks";
import { reportToken } from "./actions/report";
import { addressSearchProvider } from "./providers/address-search-provider";
import { agentPortfolioProvider } from "./providers/agent-portfolio-provider";
import { symbolSearchProvider } from "./providers/symbol-search-provider";
import { walletPortfolioProvider } from "./providers/wallet-portfolio-provider";

export const birdeyePlugin: Plugin = {
    name: "birdeye",
    description: "Birdeye Plugin for token data and analytics",
    actions: [
        reportToken,
        getSupportedNetworksAction,
        // getTokenMetadataAction,
        // getPriceHistoryAction,
        // getOHLCVAction,
        // getTokenTradesAction,
    ],
    evaluators: [],
    providers: [
        symbolSearchProvider,
        addressSearchProvider,
        walletPortfolioProvider,
        agentPortfolioProvider,
    ],
};

export default birdeyePlugin;
