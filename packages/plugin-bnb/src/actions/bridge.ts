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
import { Hex, parseEther, getContract, Address, parseUnits } from "viem";

import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { bridgeTemplate } from "../templates";
import {
    ERC20Abi,
    L1StandardBridgeAbi,
    L2StandardBridgeAbi,
    type BridgeParams,
    type BridgeResponse,
    type SupportedChain,
} from "../types";

export { bridgeTemplate };

// Exported for tests
export class BridgeAction {
    private readonly L1_BRIDGE_ADDRESS =
        "0xF05F0e4362859c3331Cb9395CBC201E3Fa6757Ea" as const;
    private readonly L2_BRIDGE_ADDRESS =
        "0x4000698e3De52120DE28181BaACda82B21568416" as const;
    private readonly LEGACY_ERC20_ETH =
        "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000" as const;

    constructor(private walletProvider: WalletProvider) {}

    async bridge(params: BridgeParams): Promise<BridgeResponse> {
        this.validateBridgeParams(params);

        const fromAddress = this.walletProvider.getAddress();

        this.walletProvider.switchChain(params.fromChain);
        const walletClient = this.walletProvider.getWalletClient(
            params.fromChain
        );
        const publicClient = this.walletProvider.getPublicClient(
            params.fromChain
        );

        try {
            const nativeToken =
                this.walletProvider.chains[params.fromChain].nativeCurrency
                    .symbol;

            let resp: BridgeResponse = {
                fromChain: params.fromChain,
                toChain: params.toChain,
                txHash: "0x",
                recipient: params.toAddress ?? fromAddress,
                amount: params.amount,
                fromToken: params.fromToken ?? nativeToken,
                toToken: params.toToken ?? nativeToken,
            };

            const account = walletClient.account!;
            const chain = this.walletProvider.getChainConfigs(params.fromChain);

            const selfBridge =
                !params.toAddress || params.toAddress == fromAddress;
            const nativeTokenBridge =
                !params.fromToken || params.fromToken == nativeToken;

            let amount: bigint;
            if (nativeTokenBridge) {
                amount = parseEther(params.amount);
            } else {
                const decimals = await publicClient.readContract({
                    address: params.fromToken!,
                    abi: ERC20Abi,
                    functionName: "decimals",
                });
                amount = parseUnits(params.amount, decimals);
            }

            let hash: Hex;
            if (params.fromChain == "bsc" && params.toChain == "opBNB") {
                // from L1 to L2
                const l1BridgeContract = getContract({
                    address: this.L1_BRIDGE_ADDRESS,
                    abi: L1StandardBridgeAbi,
                    client: {
                        public: publicClient,
                        wallet: walletClient,
                    },
                });

                // check ERC20 allowance
                if (!nativeTokenBridge) {
                    this.checkTokenAllowance(
                        params.fromChain,
                        params.fromToken!,
                        fromAddress,
                        this.L1_BRIDGE_ADDRESS,
                        amount
                    );
                }

                if (selfBridge && nativeTokenBridge) {
                    const args = [1, "0x"] as const;
                    await l1BridgeContract.simulate.depositETH(args);
                    hash = await l1BridgeContract.write.depositETH(args, {
                        account,
                        chain,
                        amount,
                    });
                } else if (selfBridge && !nativeTokenBridge) {
                    const args = [
                        params.fromToken!,
                        params.toToken!,
                        amount,
                        1,
                        "0x",
                    ] as const;
                    await l1BridgeContract.simulate.depositERC20(args);
                    hash = await l1BridgeContract.write.depositERC20(args, {
                        account,
                        chain,
                    });
                } else if (!selfBridge && nativeTokenBridge) {
                    const args = [params.toAddress!, 1, "0x"] as const;
                    await l1BridgeContract.simulate.depositETHTo(args);
                    hash = await l1BridgeContract.write.depositETHTo(args, {
                        account,
                        chain,
                        amount,
                    });
                } else {
                    const args = [
                        params.fromToken!,
                        params.toToken!,
                        params.toAddress!,
                        amount,
                        1,
                        "0x",
                    ] as const;
                    await l1BridgeContract.simulate.depositERC20To(args);
                    hash = await l1BridgeContract.write.depositERC20To(args, {
                        account,
                        chain,
                    });
                }
            } else if (params.fromChain == "opBNB" && params.toChain == "bsc") {
                // from L2 to L1
                const l2BridgeContract = getContract({
                    address: this.L2_BRIDGE_ADDRESS,
                    abi: L2StandardBridgeAbi,
                    client: {
                        public: publicClient,
                        wallet: walletClient,
                    },
                });

                const delegationFee = await publicClient.readContract({
                    address: this.L2_BRIDGE_ADDRESS,
                    abi: L2StandardBridgeAbi,
                    functionName: "delegationFee",
                });

                // check ERC20 allowance
                if (!nativeTokenBridge) {
                    this.checkTokenAllowance(
                        params.fromChain,
                        params.fromToken!,
                        fromAddress,
                        this.L2_BRIDGE_ADDRESS,
                        amount
                    );
                }

                if (selfBridge && nativeTokenBridge) {
                    const args = [
                        this.LEGACY_ERC20_ETH,
                        amount,
                        1,
                        "0x",
                    ] as const;
                    const value = amount + delegationFee;
                    await l2BridgeContract.simulate.withdraw(args, { value });
                    hash = await l2BridgeContract.write.withdraw(args, {
                        account,
                        chain,
                        value,
                    });
                } else if (selfBridge && !nativeTokenBridge) {
                    const args = [params.fromToken!, amount, 1, "0x"] as const;
                    const value = delegationFee;
                    await l2BridgeContract.simulate.withdraw(args, { value });
                    hash = await l2BridgeContract.write.withdraw(args, {
                        account,
                        chain,
                        value,
                    });
                } else if (!selfBridge && nativeTokenBridge) {
                    const args = [
                        this.LEGACY_ERC20_ETH,
                        params.toAddress!,
                        amount,
                        1,
                        "0x",
                    ] as const;
                    const value = amount + delegationFee;
                    await l2BridgeContract.simulate.withdrawTo(args, { value });
                    hash = await l2BridgeContract.write.withdrawTo(args, {
                        account,
                        chain,
                        value,
                    });
                } else {
                    const args = [
                        params.fromToken!,
                        params.toAddress!,
                        amount,
                        1,
                        "0x",
                    ] as const;
                    const value = delegationFee;
                    await l2BridgeContract.simulate.withdrawTo(args, { value });
                    hash = await l2BridgeContract.write.withdrawTo(args, {
                        account,
                        chain,
                        value,
                    });
                }

                resp.txHash = hash;
            } else {
                throw new Error("Unsupported bridge direction");
            }

            return resp;
        } catch (error) {
            throw new Error(`Bridge failed: ${error.message}`);
        }
    }

    validateBridgeParams(params: BridgeParams) {
        // Both tokens should be either null or both provided
        if ((params.fromToken === null) !== (params.toToken === null)) {
            throw new Error(
                "fromToken and toToken must be either both null or both provided"
            );
        }
    }

    async checkTokenAllowance(
        chain: SupportedChain,
        token: Address,
        owner: Address,
        spender: Address,
        amount: bigint
    ) {
        const publicClient = this.walletProvider.getPublicClient(chain);
        const allowance = await publicClient.readContract({
            address: token,
            abi: ERC20Abi,
            functionName: "allowance",
            args: [owner, spender],
        });

        if (allowance < amount) {
            elizaLogger.log("Increasing allowance for ERC20 bridge");
            const walletClient = this.walletProvider.getWalletClient(chain);
            const { request } = await publicClient.simulateContract({
                account: walletClient.account,
                address: token,
                abi: ERC20Abi,
                functionName: "increaseAllowance",
                args: [spender, amount - allowance],
            });

            await walletClient.writeContract(request);
        }
    }
}

// NOTE: The bridge action only supports bridge funds between BSC and opBNB for now. We may adding stargate support later.
export const bridgeAction = {
    name: "bridge",
    description: "Bridge tokens between BSC and opBNB",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting bridge action...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose bridge context
        const bridgeContext = composeContext({
            state,
            template: bridgeTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: bridgeContext,
            modelClass: ModelClass.LARGE,
        });

        const walletProvider = initWalletProvider(runtime);
        const action = new BridgeAction(walletProvider);
        const paramOptions: BridgeParams = {
            fromChain: content.fromChain,
            toChain: content.toChain,
            fromToken: content.fromToken,
            toToken: content.toToken,
            amount: content.amount,
            toAddress: await walletProvider.formatAddress(content.toAddress),
        };
        try {
            const bridgeResp = await action.bridge(paramOptions);
            callback?.({
                text: `Successfully bridged ${bridgeResp.amount} ${bridgeResp.fromToken} from ${bridgeResp.fromChain} to ${bridgeResp.toChain}\nTransaction Hash: ${bridgeResp.txHash}`,
                content: { ...bridgeResp },
            });
            return true;
        } catch (error) {
            elizaLogger.error("Error during token bridge:", error);
            callback?.({
                text: `Bridge failed`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: bridgeTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("BNB_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Transfer 1 BNB from BSC to opBNB",
                    action: "BRIDGE",
                },
            },
        ],
        [
            {
                user: "user",
                content: {
                    text: "Deposit 1 BNB from BSC to opBNB",
                    action: "DEPOSIT",
                },
            },
        ],
        [
            {
                user: "user",
                content: {
                    text: "Withdraw 1 BNB from opBNB to BSC",
                    action: "WITHDRAW",
                },
            },
        ],
    ],
    similes: ["BRIDGE", "TOKEN_BRIDGE", "DEPOSIT", "WITHDRAW"],
};
