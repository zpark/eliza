import {CosmosWalletProvider} from "../providers/wallet.ts";
import type {IAgentRuntime, Memory, State} from "@ai16z/eliza";


export class BalanceAction {
    constructor(private cosmosWalletProvider: CosmosWalletProvider) {
        // here configuration can be done in similar manner to `plugin-evm/actions/BridgeAction`
    }

    async getBalance() {
        try {
        const chainName = this.cosmosWalletProvider.getActiveChain();
        const address = this.cosmosWalletProvider.getAddress();
        const balance = await this.cosmosWalletProvider.getWalletBalance(chainName);

        return `Address: ${address}\nBalance: ${balance}, chain name: ${chainName}`;
        } catch (error) {
            console.error("Error in Cosmos wallet provider:", error);
            return null;
        }
    }
}

export const balanceAction = {
    name: "WalletBalance",
    description: "Action for fetching wallet balance",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any    // there can be passed setting as desired chain extracted from user prompt to chat
    ) => {
        const mnemonic = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
        const chainName =
            runtime.getSetting("COSMOS_CHAIN_NAME") || "cosmoshub";
        const provider = new CosmosWalletProvider(mnemonic);
        await provider.initialize(chainName);
        const action = new BalanceAction(provider);
        console.log(action.getBalance());
        return action.getBalance();
    },
    validate: async (runtime: IAgentRuntime) => {
        return true;
    },
    examples: [
        [
            {
                user: "User",
                content: {
                    text: "Show me balance for my cosmos wallet",
                    action: "walletProviderTestAction",
                }
            }
        ]
    ],
    similes: ["COSMOS_BALANCE", "COSMOS_WALLET_BALANCE", "COSMOS_WALLET_TOKENS"],
}
