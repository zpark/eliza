import type { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";

export { WalletProvider, transferToken as TransferMinaToken };

export const minaPlugin: Plugin = {
    name: "mina",
    description: "Mina Plugin for Eliza",
    actions: [transferToken],
    evaluators: [],
    providers: [walletProvider],
};

export default minaPlugin;
