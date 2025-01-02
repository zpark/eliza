import { cosmosWalletProvider } from "./providers/wallet.ts";
import type { Plugin } from "@ai16z/eliza";
import { balanceAction } from "./actions/walletProviderTestAction.ts";
import {transferAction} from "./actions/transfer.ts";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [cosmosWalletProvider],
    evaluators: [],
    services: [],
    actions: [transferAction, balanceAction],
};

export default cosmosPlugin;
