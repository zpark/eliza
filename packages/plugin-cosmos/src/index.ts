import {cosmosWalletProvider} from "./providers/wallet.ts";
import type { Plugin } from "@ai16z/eliza";
import { transferAction } from "./actions/transfer.ts";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [cosmosWalletProvider],
    evaluators: [],
    services: [],
    actions: [transferAction],
};

export default cosmosPlugin;
