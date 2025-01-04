import { Plugin } from "@elizaos/core";
import getPrice from "./actions/getPrice";

export const coinmarketcapPlugin: Plugin = {
    name: "coinmarketcap",
    description: "Plugin for cryptocurrency price checking using CoinGecko API (priority), CoinMarketCap API (fallback), or CoinCap API (free fallback) when no API keys are provided",
    actions: [getPrice],
    evaluators: [],
    providers: [],
};

export default coinmarketcapPlugin;
