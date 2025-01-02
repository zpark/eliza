import { transferTemplate } from "../templates";
import { Asset, CosmosTransferParams, Transaction } from "../types";
import { PaidFee } from "../services/paid-fee";
import { FeeEstimator } from "../services/fee-estimator";
import { getNativeAssetByChainName } from "@chain-registry/utils";
import { assets } from "chain-registry";
import {
    CosmosWalletProvider,
    fetchChainDetails,
    genCosmosChainsFromRuntime,
    initWalletProvider,
} from "../providers/wallet.ts";
import {
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@ai16z/eliza";
import BigNumber from "bignumber.js";
import { AssetList } from "@chain-registry/types";
import { Coin } from "@cosmjs/stargate";

export class TransferAction {
    constructor(private cosmosWalletProvider: CosmosWalletProvider) {
        this.cosmosWalletProvider = cosmosWalletProvider;
    }

    async transfer(params: CosmosTransferParams): Promise<Transaction> {
        const signingCosmWasmClient =
            await this.cosmosWalletProvider.getSigningCosmWasmClient();

        const wallet = await this.cosmosWalletProvider.getWallet();
        const accounts = await wallet.getAccounts();
        const senderAddress = accounts[0]?.address;

        if (!senderAddress) {
            throw new Error("No sender address");
        }

        if (!params.toAddress) {
            throw new Error("No receiver address");
        }

        const chainAssets: AssetList = fetchChainDetails(
            params.fromChain
        ).chainAssets;

        const formatedDenom = params.denomOrIbc.toString();

        const assetToTransfer = formatedDenom
            ? chainAssets.assets.find(
                  (asset) =>
                      asset.display === formatedDenom ||
                      asset.ibc?.source_denom === formatedDenom ||
                      asset.base === formatedDenom
              )
            : getNativeAssetByChainName(assets, params.fromChain);

        if (!assetToTransfer) {
            throw new Error(`Asset not found for denom: ${params.denomOrIbc}`);
        }

        const coin: Coin = {
            denom: assetToTransfer.base,
            amount: this.toBaseDenomAmount(params.amount, assetToTransfer),
        };

        const feeEstimator = new FeeEstimator(signingCosmWasmClient);
        const fee = await feeEstimator.estimateGasForSendTokens(
            senderAddress,
            params.toAddress,
            [coin]
        );

        const safeFee = Math.ceil(fee * 1.2).toString();

        const txDeliveryResponse = await signingCosmWasmClient.sendTokens(
            senderAddress,
            params.toAddress,
            [coin],
            { gas: safeFee, amount: [{ ...coin, amount: safeFee }] }
        );

        const gasPaidInUOM =
            PaidFee.getInstanceWithDefaultEvents().getPaidFeeFromReceipt(
                txDeliveryResponse
            );

        return {
            from: senderAddress,
            to: params.toAddress,
            gasPaidInUOM,
            txHash: txDeliveryResponse.transactionHash,
        };
    }

    private toBaseDenomAmount(amount: string, asset: Asset): string {
        const displayDenomUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );
        if (!displayDenomUnit) {
            throw new Error(
                `Display unit not found for asset: ${asset.display}`
            );
        }
        return new BigNumber(amount)
            .multipliedBy(10 ** displayDenomUnit.exponent)
            .decimalPlaces(0, BigNumber.ROUND_DOWN)
            .toString();
    }
}

export const transferAction = {
    name: "COSMOS_TRANSFER",
    description: "Transfer tokens between addresses on the same chain",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        _callback?: HandlerCallback
    ) => {
        // Compose transfer context
        const transferContext = composeContext({
            state: state,
            template: transferTemplate,
            templatingEngine: "handlebars",
        });

        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime: _runtime,
            context: transferContext,
            modelClass: ModelClass.SMALL,
        });

        const paramOptions: CosmosTransferParams = {
            fromChain: content.fromChain,
            denomOrIbc: content.denomOrIbc,
            amount: content.amount,
            toAddress: content.toAddress,
        };

        try {
            const walletProvider = await initWalletProvider(
                _runtime,
                paramOptions.fromChain
            );

            const action = new TransferAction(walletProvider);

            const transferResp = await action.transfer(paramOptions);
            if (_callback) {
                await _callback({
                    text: `Successfully transferred ${paramOptions.amount} tokens to ${paramOptions.toAddress}\nTransaction Hash: ${transferResp.txHash}`,
                    content: {
                        success: true,
                        hash: transferResp.txHash,
                        amount: paramOptions.amount,
                        recipient: transferResp.to,
                        chain: content.fromChain,
                    },
                });

                const newMemory: Memory = {
                    userId: _message.agentId,
                    agentId: _message.agentId,
                    roomId: _message.roomId,
                    content: {
                        text: `Transaction ${paramOptions.amount} ${paramOptions.denomOrIbc} to address ${paramOptions.toAddress} on chain ${paramOptions.toAddress} was successful.`,
                    },
                };

                await _runtime.messageManager.createMemory(newMemory);
            }
            return true;
        } catch (error) {
            console.error("Error during token transfer:", error);
            if (_callback) {
                await _callback({
                    text: `Error transferring tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }

            const newMemory: Memory = {
                userId: _message.agentId,
                agentId: _message.agentId,
                roomId: _message.roomId,
                content: {
                    text: `Transaction ${paramOptions.amount} ${paramOptions.denomOrIbc} to address ${paramOptions.toAddress} on chain ${paramOptions.toAddress} was unsuccessful.`,
                },
            };

            await _runtime.messageManager.createMemory(newMemory);

            return false;
        }
    },
    template: transferTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const recoveryPhrase = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
        const chains = genCosmosChainsFromRuntime(runtime);

        return recoveryPhrase !== undefined && Object.keys(chains).length > 0;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Make transfer {{0.0001 OM}} to {{mantra1pcnw46km8m5amvf7jlk2ks5std75k73aralhcf}} on {{mantrachaintestnet2}}",
                    action: "COSMOS_TRANSFER",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "",
                    action: "COSMOS_TRANSFER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send {{10 OSMO}} to {{osmo13248w8dtnn07sxc3gq4l3ts4rvfyat6f4qkdd6}} on {{osmosistestnet}}",
                    action: "COSMOS_TRANSFER",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "",
                    action: "COSMOS_TRANSFER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send {{0.0001 OM}} on {{mantrachaintestnet2}} to {{mantra1pcnw46km8m5amvf7jlk2ks5std75k73aralhcf}}",
                    action: "COSMOS_TRANSFER",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "",
                    action: "COSMOS_TRANSFER",
                },
            },
        ],
    ],
    similes: [
        "COSMOS_SEND_TOKENS",
        "COSMOS_TOKEN_TRANSFER",
        "COSMOS_MOVE_TOKENS",
    ],
};
