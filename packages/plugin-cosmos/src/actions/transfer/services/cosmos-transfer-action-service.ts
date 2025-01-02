import {
    convertDisplayUnitToBaseUnit,
    getAssetBySymbol,
} from "@chain-registry/utils";
import type { Coin } from "@cosmjs/stargate";
import { assets } from "chain-registry";
import { getPaidFeeFromReceipt } from "../../../shared/helpers/cosmos-transaction-receipt.ts";
import type {
    ICosmosActionService,
    ICosmosTransaction,
} from "../../../shared/interfaces.ts";
import { CosmosTransactionFeeEstimator } from "../../../shared/services/cosmos-transaction-fee-estimator.ts";
import type { CosmosTransferParams } from "../types.ts";
import { CosmosWalletChainsData } from "../../../shared/entities/cosmos-wallet-chains-data.ts";

export class CosmosTransferActionService implements ICosmosActionService {
    constructor(private cosmosChainsData: CosmosWalletChainsData) {
        this.cosmosChainsData = cosmosChainsData;
    }

    async execute(params: CosmosTransferParams): Promise<ICosmosTransaction> {
        const signingCosmWasmClient =
            this.cosmosChainsData.getSigningCosmWasmClient(params.chainName);

        const senderAddress = await this.cosmosChainsData.getWalletAddress(
            params.chainName
        );

        if (!senderAddress) {
            throw new Error(
                `Cannot get wallet address for chain ${params.chainName}`
            );
        }

        if (!params.toAddress) {
            throw new Error("No receiver address");
        }

        if (!params.symbol) {
            throw new Error("No symbol");
        }

        const coin: Coin = {
            denom: getAssetBySymbol(assets, params.symbol, params.chainName)
                .base,
            amount: convertDisplayUnitToBaseUnit(
                assets,
                params.symbol,
                params.amount,
                params.chainName
            ),
        };

        const gasFee =
            await CosmosTransactionFeeEstimator.estimateGasForCoinTransfer(
                signingCosmWasmClient,
                senderAddress,
                params.toAddress,
                [coin]
            );

        const txDeliveryResponse = await signingCosmWasmClient.sendTokens(
            senderAddress,
            params.toAddress,
            [coin],
            gasFee
        );

        const gasPaid = getPaidFeeFromReceipt(txDeliveryResponse);

        return {
            from: senderAddress,
            to: params.toAddress,
            gasPaid,
            txHash: txDeliveryResponse.transactionHash,
        };
    }
}
