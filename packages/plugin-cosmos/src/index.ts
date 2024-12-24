import {cosmosWalletProvider} from "./providers/wallet.ts";

export * from "./actions/transfer";

import type { Plugin } from "@ai16z/eliza";
import { transferAction } from "./actions/transfer";
import {balanceAction} from "./actions/walletProviderTestAction.ts";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [cosmosWalletProvider],
    evaluators: [],
    services: [],
    actions: [transferAction, balanceAction],
};

export default cosmosPlugin;
