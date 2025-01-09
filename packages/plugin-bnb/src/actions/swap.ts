import {
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { executeRoute, getRoutes } from "@lifi/sdk";
import { parseEther } from "viem";

import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { swapTemplate } from "../templates";
import type { SwapParams, SwapResponse } from "../types";

export { swapTemplate };

export class SwapAction {
    constructor(private walletProvider: WalletProvider) {}

    async swap(params: SwapParams): Promise<SwapResponse> {
        if (params.chain == "bscTestnet") {
            throw new Error("Testnet is not supported");
        }

        const fromAddress = this.walletProvider.getAddress();
        const chainId = this.walletProvider.getChainConfigs(params.chain).id;

        this.walletProvider.configureLiFiSdk(params.chain);
        try {
            let resp: SwapResponse = {
                chain: params.chain,
                txHash: "0x",
                fromToken: params.fromToken,
                toToken: params.toToken,
                amount: params.amount,
            };

            const routes = await getRoutes({
                fromChainId: chainId,
                toChainId: chainId,
                fromTokenAddress: params.fromToken,
                toTokenAddress: params.toToken,
                fromAmount: parseEther(params.amount).toString(),
                fromAddress: fromAddress,
                options: {
                    slippage: params.slippage,
                    order: "RECOMMENDED",
                },
            });

            if (!routes.routes.length) throw new Error("No routes found");

            const execution = await executeRoute(routes.routes[0]);
            const process = execution.steps[0]?.execution?.process[0];

            if (!process?.status || process.status === "FAILED") {
                throw new Error("Transaction failed");
            }

            resp.txHash = process.txHash as `0x${string}`;

            return resp;
        } catch (error) {
            throw new Error(`Swap failed: ${error.message}`);
        }
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap tokens on the same chain",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting swap action...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose swap context
        const swapContext = composeContext({
            state,
            template: swapTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: swapContext,
            modelClass: ModelClass.LARGE,
        });

        const swapOptions: SwapParams = {
            chain: content.chain,
            fromToken: content.inputToken,
            toToken: content.outputToken,
            amount: content.amount,
            slippage: content.slippage,
        };

        const walletProvider = initWalletProvider(runtime);
        const action = new SwapAction(walletProvider);
        try {
            const swapResp = await action.swap(swapOptions);
            callback?.({
                text: `Successfully swap ${swapResp.amount} ${swapResp.fromToken} tokens to ${swapResp.toToken}\nTransaction Hash: ${swapResp.txHash}`,
                content: { ...swapResp },
            });
            return true;
        } catch (error) {
            elizaLogger.error("Error during swap:", error.message);
            callback?.({
                text: `Swap failed`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: swapTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("BNB_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Swap 1 BNB for USDC on Bsc",
                    action: "TOKEN_SWAP",
                },
            },
        ],
    ],
    similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS"],
};
