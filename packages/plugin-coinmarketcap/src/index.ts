import { Plugin } from "@elizaos/core";
import getPrice from "./actions/getPrice";

export const coinmarketcapPlugin: Plugin = {
    name: "coinmarketcap",
    description: "Plugin for cryptocurrency price checking using CoinMarketCap API with fallback to CoinCap API when no API key is provided",
    actions: [getPrice],
    evaluators: [],
    providers: [],
};

export default coinmarketcapPlugin;
