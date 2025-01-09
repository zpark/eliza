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
import {
    getTokens,
    getToken,
    getTokenBalance,
    getTokenBalances,
    ChainId,
} from "@lifi/sdk";

import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { getBalanceTemplate } from "../templates";
import type { Balance, GetBalanceParams, GetBalanceResponse } from "../types";
import { Address, formatEther, formatUnits } from "viem";

export { getBalanceTemplate };

export class GetBalanceAction {
    constructor(private walletProvider: WalletProvider) {}

    async getBalance(params: GetBalanceParams): Promise<GetBalanceResponse> {
        let { chain, address, token } = params;

        if (chain == "bscTestnet") {
            throw new Error("Testnet is not supported");
        }

        if (!address) {
            address = this.walletProvider.getAddress();
        }

        this.walletProvider.switchChain(chain);
        const nativeSymbol =
            this.walletProvider.getChainConfigs(chain).nativeCurrency.symbol;
        const chainId = this.walletProvider.getChainConfigs(chain).id;

        this.walletProvider.configureLiFiSdk(chain);
        try {
            let resp: GetBalanceResponse = {
                chain,
                address,
                balances: [],
            };

            // If no specific token is requested, get all token balances
            if (!token) {
                const balances = await this.getTokenBalances(chainId, address);
                resp.balances = balances;
            } else {
                // If specific token is requested and it's not the native token
                if (token !== nativeSymbol) {
                    const balance = await this.getERC20TokenBalance(
                        chainId,
                        address,
                        token!
                    );
                    resp.balances = [{ token: token!, balance }];
                } else {
                    // If native token is requested
                    const nativeBalanceWei = await this.walletProvider
                        .getPublicClient(chain)
                        .getBalance({ address });
                    resp.balances = [
                        {
                            token: nativeSymbol,
                            balance: formatEther(nativeBalanceWei),
                        },
                    ];
                }
            }

            return resp;
        } catch (error) {
            throw new Error(`Get balance failed: ${error.message}`);
        }
    }

    async getERC20TokenBalance(
        chainId: ChainId,
        address: Address,
        tokenSymbol: string
    ): Promise<string> {
        const token = await getToken(chainId, tokenSymbol);
        const tokenBalance = await getTokenBalance(address, token);
        return formatUnits(tokenBalance?.amount ?? 0n, token.decimals);
    }

    async getTokenBalances(
        chainId: ChainId,
        address: Address
    ): Promise<Balance[]> {
        const tokensResponse = await getTokens();
        const tokens = tokensResponse.tokens[chainId];

        const tokenBalances = await getTokenBalances(address, tokens);
        return tokenBalances
            .filter((balance) => balance.amount && balance.amount !== 0n)
            .map((balance) => ({
                token: balance.symbol,
                balance: formatUnits(balance.amount!, balance.decimals),
            }));
    }
}

export const getBalanceAction = {
    name: "getBalance",
    description: "Get balance of a token or all tokens for the given address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting getBalance action...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose swap context
        const getBalanceContext = composeContext({
            state,
            template: getBalanceTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: getBalanceContext,
            modelClass: ModelClass.LARGE,
        });

        const walletProvider = initWalletProvider(runtime);
        const action = new GetBalanceAction(walletProvider);
        const getBalanceOptions: GetBalanceParams = {
            chain: content.chain,
            address: await walletProvider.formatAddress(content.address),
            token: content.token,
        };
        try {
            const getBalanceResp = await action.getBalance(getBalanceOptions);
            if (callback) {
                let text = `No balance found for ${getBalanceOptions.address} on ${getBalanceOptions.chain}`;
                if (getBalanceResp.balances.length > 0) {
                    text = `Balance of ${getBalanceResp.address} on ${getBalanceResp.chain}:\n${getBalanceResp.balances
                        .map(({ token, balance }) => `${token}: ${balance}`)
                        .join("\n")}`;
                }
                callback({
                    text,
                    content: { ...getBalanceResp },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in get balance:", error.message);
            callback?.({
                text: `Getting balance failed`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: getBalanceTemplate,
    validate: async (_runtime: IAgentRuntime) => {
        return true;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Check balance of USDC on Bsc",
                    action: "GET_BALANCE",
                },
            },
            {
                user: "user",
                content: {
                    text: "Check balance of USDC for 0x742d35Cc6634C0532925a3b844Bc454e4438f44e on Bsc",
                    action: "CHECK_BALANCE",
                },
            },
        ],
    ],
    similes: ["GET_BALANCE", "CHECK_BALANCE"],
};
