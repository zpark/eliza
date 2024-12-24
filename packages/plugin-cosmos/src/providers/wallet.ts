import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { chains, assets } from "chain-registry";
import type { IAgentRuntime, Provider, Memory, State } from "@ai16z/eliza";

export class CosmosWalletProvider {
    private wallet: DirectSecp256k1HdWallet;
    private address: string;
    private activeChain: string;

    constructor(private mnemonic: string) {}

    async initialize(chainName: string) {
        const { prefix } = await this.getChainConfigs(chainName);
        this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(
            this.mnemonic,
            { prefix }
        );
        const [account] = await this.wallet.getAccounts();
        this.address = account.address;
        this.activeChain = chainName;
    }

    private async getChainConfigs(chainName: string) {
        const chain = chains.find((c) => c.chain_name === chainName);
        if (!chain) throw new Error(`Chain ${chainName} not found in registry`);

        const assetList = assets.find((a) => a.chain_name === chainName);
        if (!assetList)
            throw new Error(`Assets for chain ${chainName} not found`);

        const feeToken = chain.fees.fee_tokens?.[0];
        if (!feeToken)
            throw new Error(`Fee token not found for chain ${chainName}`);

        const rpcUrl = chain.apis.rpc?.[0].address;
        if (!rpcUrl)
            throw new Error(`RPC URL not found for chain ${chainName}`);

        return {
            prefix: chain.bech32_prefix,
            feeToken,
            rpcUrl,
            chain,
            assets: assetList.assets,
        };
    }

    getAddress(): string {
        return this.address;
    }

    getActiveChain(): string {
        return this.activeChain;
    }

    async getWalletClient(chainName: string): Promise<SigningCosmWasmClient> {
        const { rpcUrl, feeToken } = await this.getChainConfigs(chainName);
        return SigningCosmWasmClient.connectWithSigner(rpcUrl, this.wallet, {
            gasPrice: GasPrice.fromString(`0.025${feeToken.denom}`),
        });
    }

    async getWalletBalance(chainName: string): Promise<string | null> {
        const client = await this.getWalletClient(chainName);
        const { feeToken } = await this.getChainConfigs(chainName);
        const balance = await client.getBalance(this.address, feeToken.denom);
        return `${balance.amount} ${balance.denom}`;
    }
}

export const cosmosWalletProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            const mnemonic = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
            const chainName =
                runtime.getSetting("COSMOS_CHAIN_NAME") || "cosmoshub";

            const provider = new CosmosWalletProvider(mnemonic);
            await provider.initialize(chainName);

            const address = provider.getAddress();
            const balance = await provider.getWalletBalance(chainName);

            return `Address: ${address}\nBalance: ${balance}, chain name: ${chainName}`;
        } catch (error) {
            console.error("Error in Cosmos wallet provider:", error);
            return null;
        }
    },
};
