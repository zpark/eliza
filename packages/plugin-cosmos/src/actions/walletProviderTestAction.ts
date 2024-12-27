import {
    CosmosWalletProvider, genCosmosChainsFromRuntime,
    initWalletProvider,
} from "../providers/wallet.ts";
import {
    composeContext,
    generateObjectDeprecated,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@ai16z/eliza";
import { balanceTemplate } from "../templates";
import { z } from "zod";

export class BalanceAction {
    constructor(private cosmosWalletProvider: CosmosWalletProvider) {}

    async getBalance() {
        try {
            const activeChain = this.cosmosWalletProvider.getActiveChain();
            const address = this.cosmosWalletProvider.getAddress();
            const balance = await this.cosmosWalletProvider.getWalletBalance();

            console.log(
                `BALANCE_ACTION: \nAddress: ${address}\nBalance: ${JSON.stringify(balance, null, 2)}, chain name: ${activeChain}`
            );

            return `Address: ${address}\nBalance: ${JSON.stringify(balance, null, 2)}, chain name: ${activeChain}`;
        } catch (error) {
            console.error("Error in Cosmos wallet provider:", error);
            return null;
        }
    }
}

export const balanceAction = {
    name: "COSMOS_WALLET_BALANCE",
    description: "Action for fetching wallet balance on given chain",
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log("COSMOS_WALLET_BALANCE action handler called");

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: balanceTemplate,
        });

        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        const balanceContentValidator = z.object({
            chainName: z.string(),
        });

        const transferContent = balanceContentValidator.parse(content);

        const { chainName } = transferContent;
        const activeChain = chainName;
        console.log(
            "transferContent",
            JSON.stringify(transferContent, null, 2)
        );

        const walletProvider = await initWalletProvider(runtime, activeChain);
        const action = new BalanceAction(walletProvider);
        return action.getBalance();
    },
    validate: async (runtime: IAgentRuntime) => {
        const recoveryPhrase = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
        const chains = genCosmosChainsFromRuntime(runtime);
        return recoveryPhrase !== undefined && Object.keys(chains).length > 0;
    },
    examples: [
        [
            {
                user: "User",
                content: {
                    text: "Show me balance of my cosmos wallet for chain mantrachaintestnet2",
                    action: "COSMOS_WALLET_BALANCE",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "Your wallet balance for chain ${name} is ${10000000} ${uom}",
                    action: "COSMOS_WALLET_BALANCE",
                },
            },
        ],
        [
            {
                user: "User",
                content: {
                    text: "Show me balance of my cosmos wallet for chain mantrachaintestnet2 use COSMOS_WALLET_BALANCE action",
                    action: "COSMOS_WALLET_BALANCE",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "Your wallet balance for chain mantrachaintestnet2 is 1234567 uom",
                    action: "COSMOS_WALLET_BALANCE",
                },
            },
        ],
    ],
    similes: ["COSMOS_BALANCE", "COSMOS_WALLET_TOKENS"],
};
