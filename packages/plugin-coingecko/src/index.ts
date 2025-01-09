import { Plugin } from "@elizaos/core";
import getPrice from "./actions/getPrice";
import getTrending from "./actions/getTrending";

export const coingeckoPlugin: Plugin = {
    name: "coingecko",
    description: "CoinGecko Plugin for Eliza",
    actions: [getPrice, getTrending],
    evaluators: [],
    providers: [],
};

export default coingeckoPlugin;
