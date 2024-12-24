import { transferTemplate } from "../templates";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Asset, CosmosTransferParams, Transaction } from "../types";
import { PaidFee } from "../services/paid-fee";
import { AssetsPicker } from "../services/assets-picker";
import { AssetsAdapter } from "../services/assets-adapter";
import { FeeEstimator } from "../services/fee-estimator";

export { transferTemplate };

export class TransferAction {
    private walletProvider: DirectSecp256k1HdWallet;
    readonly rpcEndpoint: string;
    readonly chainName: string;
    readonly assets: Asset[];

    constructor(
        walletProvider: DirectSecp256k1HdWallet,
        rpcEndpoint: string,
        chainName: string,
        assets: Asset[]
    ) {
        this.walletProvider = walletProvider;
        this.chainName = chainName;
        this.rpcEndpoint = rpcEndpoint;
        this.assets = assets;
    }

    async transfer(params: CosmosTransferParams): Promise<Transaction> {
        const signingCosmWasmClient =
            await SigningCosmWasmClient.connectWithSigner(
                this.rpcEndpoint,
                this.walletProvider
            );

        const accounts = await this.walletProvider.getAccounts();
        const senderAddress = accounts[0]?.address;

        if (!senderAddress) {
            throw new Error("No sender address");
        }

        if (!params.toAddress) {
            throw new Error("No receiver address");
        }

        try {
            const assetToTransfer = new AssetsPicker(
                this.assets
            ).getAssetByDenom(params.denomOrIbc);

            const coin = AssetsAdapter.amountToAmountInBaseDenom({
                amount: params.amount,
                asset: assetToTransfer,
                denom: params.denomOrIbc,
            });

            const feeEstimator = new FeeEstimator(signingCosmWasmClient);
            const fee = await feeEstimator.estimateGasForSendTokens(
                senderAddress,
                params.toAddress,
                [coin]
            );

            const safeFee = (fee * 1.2).toFixed();

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
        } catch (error: unknown) {
            throw new Error(
                `Transfer failed with error: ${JSON.stringify(error)}`
            );
        }
    }
}
// TODO - can be done when wallet provider is ready

// export const transferAction = {
//     name: "transfer",
//     description: "Transfer tokens between addresses on the same chain",
//     handler: async (
//         runtime: IAgentRuntime,
//         message: Memory,
//         state: State,
//         options: any,
//         callback?: HandlerCallback
//     ) => {
//         const walletProvider = initWalletProvider(runtime);
//         const action = new TransferAction(walletProvider);

//         // Compose transfer context
//         const transferContext = composeContext({
//             state,
//             template: transferTemplate,
//         });

//         // Generate transfer content
//         const content = await generateObjectDeprecated({
//             runtime,
//             context: transferContext,
//             modelClass: ModelClass.LARGE,
//         });

//         const paramOptions: TransferParams = {
//             fromChain: content.fromChain,
//             toAddress: content.toAddress,
//             amount: content.amount,
//             data: content.data,
//         };

//         try {
//             const transferResp = await action.transfer(paramOptions);
//             if (callback) {
//                 callback({
//                     text: `Successfully transferred ${paramOptions.amount} tokens to ${paramOptions.toAddress}\nTransaction Hash: ${transferResp.hash}`,
//                     content: {
//                         success: true,
//                         hash: transferResp.hash,
//                         amount: formatEther(transferResp.value),
//                         recipient: transferResp.to,
//                         chain: content.fromChain,
//                     },
//                 });
//             }
//             return true;
//         } catch (error) {
//             console.error("Error during token transfer:", error);
//             if (callback) {
//                 callback({
//                     text: `Error transferring tokens: ${error.message}`,
//                     content: { error: error.message },
//                 });
//             }
//             return false;
//         }
//     },
//     template: transferTemplate,
//     validate: async (runtime: IAgentRuntime) => {
//         const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
//         return typeof privateKey === "string" && privateKey.startsWith("0x");
//     },
//     examples: [
//         [
//             {
//                 user: "assistant",
//                 content: {
//                     text: "I'll help you transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
//                     action: "SEND_TOKENS",
//                 },
//             },
//             {
//                 user: "user",
//                 content: {
//                     text: "Transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
//                     action: "SEND_TOKENS",
//                 },
//             },
//         ],
//     ],
//     similes: ["SEND_TOKENS", "TOKEN_TRANSFER", "MOVE_TOKENS"],
// };
