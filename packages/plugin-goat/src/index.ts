import type { Plugin } from "@elizaos/core";
import { getOnChainActions } from "./actions";
import { getWalletClient, getWalletProvider } from "./wallet";

async function createGoatPlugin(
    getSetting: (key: string) => string | undefined
): Promise<Plugin> {
    const walletClient = getWalletClient(getSetting);
    // @ts-expect-error todo
    const actions = await getOnChainActions(walletClient);

    return {
        name: "[GOAT] Onchain Actions",
        description: "Mode integration plugin",
        // @ts-expect-error todo
        providers: [getWalletProvider(walletClient)],
        evaluators: [],
        services: [],
        actions: actions,
    };
}

export default createGoatPlugin;
