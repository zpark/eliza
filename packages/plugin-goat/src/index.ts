export * from "./actions";
export * from "./wallet";

import type { Plugin } from "@elizaos/core";
import { goatWalletProvider } from "./wallet";
import { getOnChainActions } from "./actions";

console.log("\n┌════════════════════════════════════════┐");
console.log("│          GOAT SDK PLUGIN               │");
console.log("├────────────────────────────────────────┤");
console.log("│  Initializing GOAT Plugin...           │");
console.log("└════════════════════════════════════════┘");

const initializeActions = async () => {
    try {
        const actions = await getOnChainActions();
        console.log("✔ GOAT actions initialized successfully.");
        return actions;
    } catch (error) {
        console.error("❌ Failed to initialize GOAT actions:", error);
        return [];
    }
};

export const goatPlugin: Plugin = {
    name: "[GOAT] Onchain Actions",
    description: "Goat SDK integration for EVM chains",
    providers: [goatWalletProvider],
    evaluators: [],
    services: [],
    actions: await initializeActions(),
};

export default goatPlugin;
