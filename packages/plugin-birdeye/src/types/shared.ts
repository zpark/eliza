import { CHAIN_KEYWORDS } from "../utils";

// Types
export type BirdeyeChain = (typeof CHAIN_KEYWORDS)[number];

export interface BaseAddress {
    type?: "wallet" | "token" | "contract";
    symbol?: string;
    address: string;
    chain: BirdeyeChain;
}

export interface WalletAddress extends BaseAddress {
    type: "wallet";
}

export interface TokenAddress extends BaseAddress {
    type: "token";
}

export interface ContractAddress extends BaseAddress {
    type: "contract";
}
