import { cosmosWalletProvider } from "./providers/wallet.ts";
import type { Plugin } from "@elizaos/core";
import { balanceAction } from "./actions/walletProviderTestAction.ts";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [cosmosWalletProvider],
    evaluators: [],
    services: [],
    actions: [balanceAction],
};

export default cosmosPlugin;
