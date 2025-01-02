import { transferAction } from "./actions/transfer";
import type { Plugin } from "@ai16z/eliza";
import { cosmosWalletProvider } from "./providers/wallet";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [cosmosWalletProvider],
    evaluators: [],
    services: [],
    actions: [transferAction],
};

export default cosmosPlugin;
