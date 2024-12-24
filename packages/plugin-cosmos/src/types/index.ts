import { CosmosTransferParams } from "../actions/cosmosTransfer";
import { assets } from "chain-registry";

export type Asset = Pick<
    (typeof assets)[number]["assets"][number],
    "base" | "denom_units" | "display"
>;

export type Coin = {
    denom: string;
    amount: string;
};

export interface Transaction {
    from: string;
    to: string;
    txHash: string;
    gasPaidInUOM: number;
}

export { CosmosTransferParams };
