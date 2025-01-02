import { Coin, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { assets, chains } from "chain-registry";
import {
    composeContext,
    generateObjectDeprecated,
    IAgentRuntime,
    Memory,
    ModelClass,
    Provider,
    State,
} from "@ai16z/eliza";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Chain } from "../types";
import { balanceTemplate } from "../templates";
import { z } from "zod";

export class CosmosWalletProvider {
    private wallet: DirectSecp256k1HdWallet;
    private client: SigningCosmWasmClient;
    private address: string;
    private activeChain: string;
    private readonly mnemonic: string;
    private characterChains: Record<string, Chain>;

    constructor(mnemonic: string, characterChains: Record<string, Chain>) {
        this.mnemonic = mnemonic;
        this.characterChains = characterChains;
    }

    async initialize(chainName: string) {
        await this.setActiveChain(chainName);
        this.wallet = await this.getWallet();
        const [account] = await this.wallet.getAccounts();

        this.address = account.address;
        this.client = await this.getSigningCosmWasmClient();
    }

    async getWallet() {
        const { bech32Prefix } = this.characterChains[this.activeChain];

        return await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
            prefix: bech32Prefix,
        });
    }

    getAddress(): string {
        if (this.address === undefined) {
            throw new Error("No address provided");
        } else {
            return this.address;
        }
    }

    getActiveChain(): string {
        if (this.activeChain === undefined) {
            throw new Error("No active chain provided");
        } else {
            return this.activeChain;
        }
    }

    async getSigningCosmWasmClient(): Promise<SigningCosmWasmClient> {
        const { rpcUrl } = this.characterChains[this.activeChain];

        return await SigningCosmWasmClient.connectWithSigner(
            rpcUrl,
            this.wallet,
        );
    }

    async getWalletBalance(): Promise<Coin> {
        if (!this.client || !this.address) {
            throw new Error(
                "CosmWasm client is not initialized. Please call `initialize` first."
            );
        }

        const { feeToken } = this.characterChains[this.activeChain];

        return await this.client.getBalance(this.address, feeToken.denom);
    }

    async setActiveChain(chainName: string) {
        if (this.characterChains[chainName] !== undefined) {
            this.activeChain = chainName;
            this.wallet = await this.getWallet();
            const [account] = await this.wallet.getAccounts();

            this.address = account.address;

            return this.activeChain;
        } else {
            throw new Error(
                `Character does not support chain ${chainName}. Add this chain to character.settings.chains.cosmos`
            );
        }
    }
}

export const genCosmosChainsFromRuntime = (
    runtime: IAgentRuntime
): Record<string, Chain> => {
    const chainNames: string[] =
        (runtime.character.settings.chains?.cosmos as string[]) || [];
    const characterChains: Record<string, Chain> = {};

    chainNames.forEach((chainName) => {
        characterChains[chainName] = fetchChainDetails(chainName);
    });

    return characterChains;
};

export const fetchChainDetails = (chainName: string): Chain => {
    const chain = chains.find((c) => c.chain_name === chainName);

    if (!chain) throw new Error(`Chain ${chainName} not found in registry`);

    const assetList = assets.find((a) => a.chain_name === chainName);

    if (!assetList) throw new Error(`Assets for chain ${chainName} not found`);

    const feeToken = chain.fees.fee_tokens?.[0];

    if (!feeToken)
        throw new Error(`Fee token not found for chain ${chainName}`);

    const rpcUrl = chain.apis.rpc?.[0]?.address;

    if (!rpcUrl) throw new Error(`RPC URL not found for chain ${chainName}`);

    return {
        chainName,
        rpcUrl,
        bech32Prefix: chain.bech32_prefix,
        feeToken,
        chainAssets: assetList,
    };
};

export const initWalletProvider = async (
    runtime: IAgentRuntime,
    chainName: string
) => {
    const mnemonic = runtime.getSetting("COSMOS_RECOVERY_PHRASE");

    if (!mnemonic) {
        throw new Error("COSMOS_RECOVERY_PHRASE is missing");
    }

    const characterChains = genCosmosChainsFromRuntime(runtime);
    const provider = new CosmosWalletProvider(mnemonic, characterChains);

    await provider.initialize(chainName);

    return provider;
};

export const cosmosWalletProvider: Provider = {
    get: async function (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string | null> {
        const transferContext = composeContext({
            state: state,
            template: balanceTemplate,
            templatingEngine: "handlebars",
        });

        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.SMALL,
        });

        const balanceContentValidator = z.object({
            chainName: z.string(),
        });

        try {
            const transferContent = balanceContentValidator.parse(content);

            const { chainName } = transferContent;

            const provider = await initWalletProvider(runtime, chainName);

            const address = provider.getAddress();
            const balance = await provider.getWalletBalance();
            const activeChain = provider.getActiveChain();

            return `Address: ${address}\nBalance: ${balance.amount} ${balance.denom}\nActive Chain: ${activeChain}`;
        } catch (error) {
            console.error(
                "Error Initializing in Cosmos wallet provider:",
                error
            );

            return null;
        }
    },
};
