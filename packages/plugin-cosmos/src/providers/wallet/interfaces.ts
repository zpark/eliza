import type { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import type { Coin, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export interface ICosmosWallet {
    directSecp256k1HdWallet: DirectSecp256k1HdWallet;

    getWalletAddress(): Promise<string>;
    getWalletBalances(): Promise<Coin[]>;
}

export interface ICosmosChainWallet {
    wallet: ICosmosWallet;
    signingCosmWasmClient: SigningCosmWasmClient;
}

export interface ICosmosWalletProviderChainsData {
    [chainName: string]: ICosmosChainWallet;
}
