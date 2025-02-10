export * from "./inventory/wallet.ts";

import { Plugin } from "@elizaos/core";
import { inventoryProvider } from "./inventory/wallet.ts";

export const dummyInventoryPlugin: Plugin = {
    name: "dummy-inventory",
    description: "Dummy Inventory Plugin for Eliza",
    inventoryProviders: [inventoryProvider]
};

export default dummyInventoryPlugin;
