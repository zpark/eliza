import { AssetList } from "@chain-registry/types";
import { getChainByChainName } from "@chain-registry/utils";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { assets, chains } from "chain-registry";
import { ICosmosWalletProviderChainsData } from "../../providers/wallet/interfaces";
import { CosmosWallet } from "./cosmos-wallet";

export class CosmosWalletChainsData {
    public chainsData: ICosmosWalletProviderChainsData = {};

    private constructor(chainsData: ICosmosWalletProviderChainsData) {
        this.chainsData = chainsData;
    }

    public static async create(
        mnemonic: string,
        availableChainNames: string[]
    ) {
        const chainsData: ICosmosWalletProviderChainsData = {};

        for (const chainName of availableChainNames) {
            const chain = getChainByChainName(chains, chainName);

            if (!chain) {
                throw new Error(`Chain ${chainName} not found`);
            }

            const wallet = await CosmosWallet.create(
                mnemonic,
                chain.bech32_prefix,
                chain.apis.rpc[0].address
            );

            const chainRpcAddress = chain.apis?.rpc?.[0].address;

            if (!chainRpcAddress) {
                throw new Error(`RPC address not found for chain ${chainName}`);
            }

            const signingCosmWasmClient =
                await SigningCosmWasmClient.connectWithSigner(
                    chain.apis.rpc[0].address,
                    wallet.directSecp256k1HdWallet
                );

            chainsData[chainName] = {
                wallet,
                signingCosmWasmClient,
            };
        }

        return new CosmosWalletChainsData(chainsData);
    }

    public async getWalletAddress(chainName: string) {
        return await this.chainsData[chainName].wallet.getWalletAddress();
    }

    public getSigningCosmWasmClient(chainName: string) {
        return this.chainsData[chainName].signingCosmWasmClient;
    }

    public getAssetsList(chainName: string, customAssetList?: AssetList[]) {
        const assetList = (customAssetList ?? assets).find(
            (asset) => asset.chain_name === chainName
        );

        if (!assetList) {
            throw new Error(`Assets for chain ${chainName} not found`);
        }

        return assetList;
    }
}
