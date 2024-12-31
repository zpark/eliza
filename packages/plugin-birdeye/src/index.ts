import { Plugin } from "@elizaos/core";
import { searchTokensBySymbolAction } from "./actions/searchTokens";
import { searchWalletsAction } from "./actions/searchWallets";
import { testAllEndpointsAction } from "./actions/test-all-endpoints";
import { agentPortfolioProvider } from "./providers/agent-portfolio-provider";

export const birdeyePlugin: Plugin = {
    name: "birdeye",
    description: "Birdeye Plugin for token data and analytics",
    actions: [
        searchTokensBySymbolAction,
        searchWalletsAction,
        testAllEndpointsAction,
    ],
    evaluators: [],
    providers: [agentPortfolioProvider],
};

export default birdeyePlugin;
