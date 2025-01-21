import { Plugin } from "@elizaos/core";
import transfer from "./actions/transfer.ts";
import { initiaWalletProvider } from "./providers/wallet.ts";

export const initiaPlugin: Plugin = {
    name: "initiaPlugin",
    description: "Initia Plugin for Eliza",
    actions: [
        transfer,
    ],
    evaluators: [],
    providers: [initiaWalletProvider],
};
