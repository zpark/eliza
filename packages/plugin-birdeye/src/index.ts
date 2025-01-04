import { Plugin } from "@elizaos/core";
import { getWalletInfoAction } from "./actions/get-wallet-info";
import { tokenSearchAddressAction } from "./actions/token-search-address";
import { tokenSearchSymbolAction } from "./actions/token-search-symbol";
import { agentPortfolioProvider } from "./providers/agent-portfolio-provider";

export const birdeyePlugin: Plugin = {
    name: "birdeye",
    description: "Birdeye Plugin for token data and analytics",
    actions: [
        tokenSearchSymbolAction,
        getWalletInfoAction,
        tokenSearchAddressAction,
        // testAllEndpointsAction, // this action can be used to optionally test all endpoints
    ],
    evaluators: [],
    providers: [agentPortfolioProvider],
};

export default birdeyePlugin;
