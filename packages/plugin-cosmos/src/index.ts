import { createTransferAction } from "./actions/transfer";
import type { Plugin } from "@ai16z/eliza";
import { createCosmosWalletProvider } from "./providers/wallet";
import { ICosmosPluginOptions } from "./shared/interfaces";

export const createCosmosPlugin = (
    pluginOptions?: ICosmosPluginOptions
): Plugin => ({
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [createCosmosWalletProvider(pluginOptions)],
    evaluators: [],
    services: [],
    actions: [createTransferAction(pluginOptions)],
});

export default createCosmosPlugin;
