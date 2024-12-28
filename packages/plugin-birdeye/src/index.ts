import { Plugin } from "@elizaos/core";
import { getSupportedNetworksAction } from "./actions/defi/networks";
import { reportToken } from "./actions/report";
import { addressSearchProvider } from "./providers/address-search-provider";
import { birdeyeProvider } from "./providers/birdeye";

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
    providers: [addressSearchProvider, birdeyeProvider],
};

export default birdeyePlugin;
