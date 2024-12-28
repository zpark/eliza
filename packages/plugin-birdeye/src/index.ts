import { Plugin } from "@elizaos/core";
import { getSupportedNetworksAction } from "./actions/defi/networks";
import { addressSearchProvider } from "./providers/address-search-provider";

export const birdeyePlugin: Plugin = {
    name: "birdeye",
    description: "Birdeye Plugin for token data and analytics",
    actions: [
        getSupportedNetworksAction,
        // getTokenMetadataAction,
        // getPriceHistoryAction,
        // getOHLCVAction,
        // getTokenTradesAction,
    ],
    evaluators: [],
    providers: [addressSearchProvider],
};

export default birdeyePlugin;
