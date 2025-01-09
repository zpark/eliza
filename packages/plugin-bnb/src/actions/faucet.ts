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
import { type Hex } from "viem";
import WebSocket, { ClientOptions } from "ws";

import { faucetTemplate } from "../templates";
import { type FaucetParams } from "../types";
import { initWalletProvider } from "../providers/wallet";

export { faucetTemplate };

// Exported for tests
export class FaucetAction {
    private readonly SUPPORTED_TOKENS: string[] = [
        "BNB",
        "BTC",
        "BUSD",
        "DAI",
        "ETH",
        "USDC",
    ] as const;
    private readonly FAUCET_URL = "wss://testnet.bnbchain.org/faucet-smart/api";
    constructor() {}

    async faucet(params: FaucetParams): Promise<Hex> {
        this.validateParams(params);

        return new Promise((resolve, reject) => {
            const options: ClientOptions = {
                headers: {
                    Connection: "Upgrade",
                    Upgrade: "websocket",
                },
            };
            const ws = new WebSocket(this.FAUCET_URL, options);

            ws.onopen = () => {
                const message = {
                    tier: 0,
                    url: params.toAddress,
                    symbol: params.token || "BNB",
                    captcha: "noCaptchaToken",
                };
                ws.send(JSON.stringify(message));
            };

            ws.onmessage = (event: WebSocket.MessageEvent) => {
                const response = JSON.parse(event.data.toString());

                // First response: funding request accepted
                if (response.success) {
                    return; // Wait for the next message
                }

                // Second response: transaction details
                if (response.requests && response.requests.length > 0) {
                    const txHash = response.requests[0].tx.hash;
                    if (txHash) {
                        resolve(txHash as Hex);
                        ws.close();
                        return;
                    }
                }

                // Handle error case
                if (response.error) {
                    reject(new Error(response.error));
                    ws.close();
                }
            };

            ws.onerror = (error: WebSocket.ErrorEvent) => {
                reject(new Error(`WebSocket error occurred: ${error.message}`));
            };

            // Add timeout to prevent hanging
            setTimeout(() => {
                ws.close();
                reject(new Error("Faucet request timeout"));
            }, 15000); // 15 seconds timeout
        });
    }

    validateParams(params: FaucetParams): void {
        if (params.token && !this.SUPPORTED_TOKENS.includes(params.token!)) {
            throw new Error("Invalid token");
        }
    }
}

export const faucetAction = {
    name: "faucet",
    description: "Get test tokens from the faucet",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting faucet action...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose faucet context
        const faucetContext = composeContext({
            state,
            template: faucetTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: faucetContext,
            modelClass: ModelClass.LARGE,
        });

        const walletProvider = initWalletProvider(runtime);
        const action = new FaucetAction();
        const paramOptions: FaucetParams = {
            token: content.token,
            toAddress: await walletProvider.formatAddress(content.toAddress),
        };
        try {
            const faucetResp = await action.faucet(paramOptions);
            callback?.({
                text: `Successfully transferred ${paramOptions.token} to ${paramOptions.toAddress}\nTransaction Hash: ${faucetResp}`,
                content: {
                    hash: faucetResp,
                    recipient: paramOptions.toAddress,
                    chain: content.chain,
                },
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error during get test tokens:", error);
            callback?.({
                text: `Error during get test tokens: ${error.message}`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: faucetTemplate,
    validate: async (runtime: IAgentRuntime) => {
        return true;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Request some test tokens from the faucet on BSC Testnet",
                    action: "FAUCET",
                },
            },
        ],
    ],
    similes: ["FAUCET", "GET_TEST_TOKENS"],
};
