export * from "./evaluators/trust.ts";
export * from "./providers/token.ts";
export * from "./providers/trustScoreProvider.ts";
export * from "./providers/wallet.ts";

import { Plugin } from "@elizaos/core";
import fomo from "./actions/fomo.ts";
import pumpfun from "./actions/pumpfun.ts";
import { executeSwap } from "./actions/swap.ts";
import { executeSwapForDAO } from "./actions/swapDao";
import take_order from "./actions/takeOrder";
import transferToken from "./actions/transfer.ts";
import { trustEvaluator } from "./evaluators/trust.ts";
import { TokenProvider } from "./providers/token.ts";
import { walletProvider, WalletProvider } from "./providers/wallet.ts";

export { TokenProvider, WalletProvider };

export const solanaPlugin: Plugin = {
    name: "solana",
    description: "Solana Plugin for Eliza",
    actions: [
        executeSwap,
        pumpfun,
        fomo,
        transferToken,
        executeSwapForDAO,
        take_order,
    ],
    evaluators: [trustEvaluator],
    // providers: [walletProvider, trustScoreProvider],
    providers: [walletProvider],
};

export default solanaPlugin;
