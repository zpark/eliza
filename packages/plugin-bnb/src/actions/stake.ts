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

import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { stakeTemplate } from "../templates";
import {
    ERC20Abi,
    ListaDaoAbi,
    SupportedChain,
    type StakeParams,
    type StakeResponse,
} from "../types";
import { formatEther, Hex, parseEther } from "viem";

export { stakeTemplate };

// Exported for tests
export class StakeAction {
    private readonly LISTA_DAO =
        "0x1adB950d8bB3dA4bE104211D5AB038628e477fE6" as const;
    private readonly SLIS_BNB =
        "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B" as const;

    constructor(private walletProvider: WalletProvider) {}

    async stake(params: StakeParams): Promise<StakeResponse> {
        this.validateStakeParams(params);

        this.walletProvider.switchChain("bsc"); // only BSC is supported

        try {
            const actions = {
                deposit: async () => await this.doDeposit(params.amount!),
                withdraw: async () => await this.doWithdraw(params.amount),
                claim: async () => await this.doClaim(),
            };
            const resp = await actions[params.action]();
            return { response: resp };
        } catch (error) {
            throw new Error(`Stake failed: ${error.message}`);
        }
    }

    validateStakeParams(params: StakeParams) {
        if (params.action == "deposit" && !params.amount) {
            throw new Error("Amount is required for deposit");
        }

        if (params.action == "withdraw" && !params.amount) {
            throw new Error("Amount is required for withdraw");
        }
    }

    async doDeposit(amount: string): Promise<string> {
        const publicClient = this.walletProvider.getPublicClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );
        const walletClient = this.walletProvider.getWalletClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );

        const { request } = await publicClient.simulateContract({
            account: walletClient.account,
            address: this.LISTA_DAO,
            abi: ListaDaoAbi,
            functionName: "deposit",
            value: parseEther(amount),
        });
        const txHash = await walletClient.writeContract(request);

        const slisBNBBalance = await publicClient.readContract({
            address: this.SLIS_BNB,
            abi: ERC20Abi,
            functionName: "balanceOf",
            args: [walletClient.account!.address],
        });

        return `Successfully do deposit. ${formatEther(slisBNBBalance)} slisBNB held. \nTransaction Hash: ${txHash}`;
    }

    async doWithdraw(amount?: string): Promise<string> {
        const publicClient = this.walletProvider.getPublicClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );
        const walletClient = this.walletProvider.getWalletClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );

        // If amount is not provided, withdraw all slisBNB
        let amountToWithdraw: bigint;
        if (!amount) {
            amountToWithdraw = await publicClient.readContract({
                address: this.SLIS_BNB,
                abi: ERC20Abi,
                functionName: "balanceOf",
                args: [walletClient.account!.address],
            });
        } else {
            amountToWithdraw = parseEther(amount);
        }

        const { request } = await publicClient.simulateContract({
            account: walletClient.account,
            address: this.LISTA_DAO,
            abi: ListaDaoAbi,
            functionName: "requestWithdraw",
            args: [amountToWithdraw],
        });

        const txHash = await walletClient.writeContract(request);

        const slisBNBBalance = await publicClient.readContract({
            address: this.SLIS_BNB,
            abi: ERC20Abi,
            functionName: "balanceOf",
            args: [walletClient.account!.address],
        });

        return `Successfully do withdraw. ${formatEther(slisBNBBalance)} slisBNB left. \nTransaction Hash: ${txHash}`;
    }

    async doClaim(): Promise<string> {
        const publicClient = this.walletProvider.getPublicClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );
        const walletClient = this.walletProvider.getWalletClient(
            this.walletProvider.getCurrentChain().name as SupportedChain
        );

        const address = walletClient.account!.address;
        const requests = await publicClient.readContract({
            address: this.LISTA_DAO,
            abi: ListaDaoAbi,
            functionName: "getUserWithdrawalRequests",
            args: [address],
        });

        let totalClaimed = 0n;
        for (let idx = 0; idx < requests.length; idx++) {
            const [isClaimable, amount] = await publicClient.readContract({
                address: this.LISTA_DAO,
                abi: ListaDaoAbi,
                functionName: "getUserRequestStatus",
                args: [address, BigInt(idx)],
            });

            if (isClaimable) {
                const { request } = await publicClient.simulateContract({
                    account: walletClient.account,
                    address: this.LISTA_DAO,
                    abi: ListaDaoAbi,
                    functionName: "claimWithdraw",
                    args: [BigInt(idx)],
                });

                await walletClient.writeContract(request);

                totalClaimed += amount;
            } else {
                break;
            }
        }

        return `Successfully do claim. ${formatEther(totalClaimed)} BNB claimed.`;
    }
}

export const stakeAction = {
    name: "stake",
    description: "Stake related actions through Lista DAO",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting stake action...");

        // Validate stake
        if (!(message.content.source === "direct")) {
            callback?.({
                text: "I can't do that for you.",
                content: { error: "Stake not allowed" },
            });
            return false;
        }

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose stake context
        const stakeContext = composeContext({
            state,
            template: stakeTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: stakeContext,
            modelClass: ModelClass.LARGE,
        });

        const walletProvider = initWalletProvider(runtime);
        const action = new StakeAction(walletProvider);
        const paramOptions: StakeParams = {
            action: content.action,
            amount: content.amount,
        };
        try {
            const stakeResp = await action.stake(paramOptions);
            callback?.({
                text: stakeResp.response,
                content: { ...stakeResp },
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error during transfer:", error);
            callback?.({
                text: `Stake failed`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: stakeTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("BNB_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Delegate 1 BNB",
                    action: "delegate",
                },
            },
            {
                user: "user",
                content: {
                    text: "Stake 1 BNB",
                    action: "stake",
                },
            },
            {
                user: "user",
                content: {
                    text: "Deposit 1 BNB to Lista DAO",
                    action: "deposit",
                },
            },
            {
                user: "user",
                content: {
                    text: "Withdraw 1 BNB from Lista DAO",
                    action: "withdraw",
                },
            },
            {
                user: "user",
                content: {
                    text: "Claim locked BNB",
                    action: "claim",
                },
            },
        ],
    ],
    similes: [
        "DELEGATE",
        "STAKE",
        "DEPOSIT",
        "UNDELEGATE",
        "UNSTAKE",
        "WITHDRAW",
        "CLAIM",
    ],
};
