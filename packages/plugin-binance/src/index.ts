import { Plugin } from "@elizaos/core";
import { priceCheck } from "./actions/priceCheck";
import { spotBalance } from "./actions/spotBalance";
import { spotTrade } from "./actions/spotTrade";

// Re-export types and services for external use
export * from "./services";
export * from "./types";

// Export the plugin configuration
export const binancePlugin: Plugin = {
    name: "binance",
    description: "Binance Plugin for Eliza",
    actions: [spotTrade, priceCheck, spotBalance],
    evaluators: [],
    providers: [],
};

export default binancePlugin;
