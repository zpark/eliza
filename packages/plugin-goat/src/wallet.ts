import type { IAgentRuntime, Memory, State, Provider } from "@elizaos/core";
import type { WalletClientBase } from "@goat-sdk/core";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

// Add the chain you want to use, remember to update also
// the EVM_PROVIDER_URL to the correct one for the chain
export const chain = mode;

export function initWalletClient(runtime: IAgentRuntime): WalletClientBase | null {
    const privateKey = runtime.getSetting("GOAT_EVM_PRIVATE_KEY");
    if (!privateKey) return null;

    const provider = runtime.getSetting("GOAT_EVM_PROVIDER_URL");
    if (!provider) throw new Error("GOAT_EVM_PROVIDER_URL not configured");

    const wallet = createWalletClient({
        account: privateKeyToAccount(privateKey as `0x${string}`),
        chain: chain,
        transport: http(provider),
    });

    return viem(wallet);
}

export const goatWalletProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string | null> {
        try {
            const walletClient = initWalletClient(runtime);
            if (!walletClient) return null;
            const address = walletClient.getAddress();
            const balance = await walletClient.balanceOf(address);
            return `EVM Wallet Address: ${address}\nBalance: ${balance} ETH\nChain: ${chain.name} (${chain.id})`;
        } catch (error) {
            console.error("Error in EVM wallet provider:", error);
            return null;
        }
    },
};
