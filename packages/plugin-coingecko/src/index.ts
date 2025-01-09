import { Plugin } from "@elizaos/core";
import getMarkets from "./actions/getMarkets";
import getPrice from "./actions/getPrice";
import getTrending from "./actions/getTrending";
import { categoriesProvider } from "./providers/categoriesProvider";

export const coingeckoPlugin: Plugin = {
    name: "coingecko",
    description: "CoinGecko Plugin for Eliza",
    actions: [getPrice, getTrending, getMarkets],
    evaluators: [],
    providers: [categoriesProvider],
};

export default coingeckoPlugin;
