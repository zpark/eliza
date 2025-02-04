import type { Action, Plugin } from "@elizaos/core";
import { getOnChainActions } from "./actions";
import { getZilliqaWalletClient, getWalletProviders } from "./wallet";
import type { WalletClientBase } from "@goat-sdk/core";
import type { ZilliqaWalletClient } from "@goat-sdk/wallet-zilliqa";

// Initial banner
console.log("\n┌════════════════════════════════════════┐");
console.log("│          ZILLIQA PLUGIN                │");
console.log("├────────────────────────────────────────┤");
console.log("│  Initializing Zilliqa Plugin...        │");
console.log("└════════════════════════════════════════┘");

type InitResult = {
    actions: Action[];
    walletClient: WalletClientBase | null;
    zilliqaWalletClient: ZilliqaWalletClient | null;
};

const initializeActions = async (getSetting: (key: string) => string | undefined): Promise<InitResult> => {
    try {
        const zilliqaWalletClient = await getZilliqaWalletClient(getSetting);
        if (!zilliqaWalletClient) {
            console.warn("⚠️ Zilliqa wallet client initialization failed. Ensure that ZILLIQA_PRIVATE_KEY and ZILLIQA_PROVIDER_URL are configured.");
            return {
                actions: [],
                walletClient: null,
                zilliqaWalletClient: null,
            };
        }
        const walletClient = zilliqaWalletClient.getEVM();
        const actions = await getOnChainActions(walletClient, zilliqaWalletClient);
        console.log("✔ Zilliqa actions initialized successfully.");
        return {
            actions,
            walletClient,
            zilliqaWalletClient,
        };
    } catch (error) {
        console.error("❌ Failed to initialize Zilliqa actions:", error);
        return {
            actions: [],
            walletClient: null,
            zilliqaWalletClient: null,
        };
    }
};

const initialized = await initializeActions((key: string) => process.env[key]);

export const zilliqaPlugin: Plugin = {
    name: "[ZILLIQA] Onchain Actions",
    description: "Zilliqa integration plugin",
    providers: initialized.walletClient && initialized.zilliqaWalletClient 
        ? getWalletProviders(initialized.walletClient, initialized.zilliqaWalletClient)
        : [],
    evaluators: [],
    services: [],
    actions: initialized.actions,
};

export default zilliqaPlugin;
