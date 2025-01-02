import { IAgentRuntime, Provider } from "@ai16z/eliza";
import { getChainByChainName } from "@chain-registry/utils";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Coin, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { chains } from "chain-registry";
import { cosmos } from "interchain";

type RPCQueryClient = Awaited<
    ReturnType<typeof cosmos.ClientFactory.createRPCQueryClient>
>;

interface ICosmosWallet {
    directSecp256k1HdWallet: DirectSecp256k1HdWallet;

    getWalletAddress(): Promise<string>;
    getWalletBalances(): Promise<Coin[]>;
}

interface ICosmosChainWallet {
    wallet: ICosmosWallet;
    signingCosmWasmClient: SigningCosmWasmClient;
}

interface ICosmosWalletProviderChainsData {
    [chainName: string]: ICosmosChainWallet;
}

class CosmosWallet implements ICosmosWallet {
    public rpcQueryClient: RPCQueryClient;
    public directSecp256k1HdWallet: DirectSecp256k1HdWallet;

    private constructor(
        directSecp256k1HdWallet: DirectSecp256k1HdWallet,
        rpcQueryClient: RPCQueryClient
    ) {
        this.directSecp256k1HdWallet = directSecp256k1HdWallet;
        this.rpcQueryClient = rpcQueryClient;
    }

    public static async create(
        mnemonic: string,
        chainPrefix: string,
        rpcEndpoint: string
    ) {
        const directSecp256k1HdWallet =
            await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
                prefix: chainPrefix,
            });

        const rpcQueryClient = await cosmos.ClientFactory.createRPCQueryClient({
            rpcEndpoint,
        });

        return new CosmosWallet(directSecp256k1HdWallet, rpcQueryClient);
    }

    public async getWalletAddress() {
        const [account] = await this.directSecp256k1HdWallet.getAccounts();

        return account.address;
    }

    public async getWalletBalances() {
        const walletAddress = await this.getWalletAddress();

        const allBalances =
            await this.rpcQueryClient.cosmos.bank.v1beta1.allBalances({
                address: walletAddress,
            });

        return allBalances.balances;
    }
}

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
}

export class CosmosWalletProvider implements Provider {
    private async initWalletProvider(runtime: IAgentRuntime) {
        const mnemonic = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
        const availableChains = runtime.getSetting("COSMOS_AVAILABLE_CHAINS");

        if (!mnemonic) {
            throw new Error("COSMOS_RECOVERY_PHRASE is missing");
        }

        if (!availableChains) {
            throw new Error("COSMOS_AVAILABLE_CHAINS is missing");
        }

        const availableChainsArray = availableChains.split(",");

        if (!availableChainsArray.length) {
            throw new Error("COSMOS_AVAILABLE_CHAINS is empty");
        }

        return await CosmosWalletChainsData.create(
            mnemonic,
            availableChainsArray
        );
    }

    public async get(runtime: IAgentRuntime) {
        let providerContextMessage = "";

        try {
            const provider = await this.initWalletProvider(runtime);

            for (const [chainName, chainData] of Object.entries(
                provider.chainsData
            )) {
                const address = await chainData.wallet.getWalletAddress();
                const balances = await chainData.wallet.getWalletBalances();

                const balancesToString = balances
                    .map((balance) => `- ${balance.amount} ${balance.denom}`)
                    .join("\n");

                providerContextMessage += `Chain: ${chainName}\nAddress: ${address}\nBalances:\n${balancesToString}\n________________\n`;
            }

            return providerContextMessage;
        } catch (error) {
            console.error(
                "Error Initializing in Cosmos wallet provider:",
                error
            );

            return null;
        }
    }
}
