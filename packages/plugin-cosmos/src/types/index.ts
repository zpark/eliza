import type { Coin as AminoCoin } from "@cosmjs/amino";
import { CosmosTransferParams } from "../services/cosmos-transfer-params-validator";
import { assets } from "chain-registry";

export type Asset = Pick<
    (typeof assets)[number]["assets"][number],
    "base" | "denom_units" | "display"
>;

export type Coin = AminoCoin;

export interface Transaction {
    from: string;
    to: string;
    txHash: string;
    gasPaidInUOM: number;
}

export { CosmosTransferParams };

export type Chain = {
    chainName: string;
    rpcUrl: string;
    bech32Prefix: string;
    feeToken: {
        denom: string;
    };
};
