import {
    IAgentRuntime,
    Memory,
    Provider,
    State,
    elizaLogger,
} from "@elizaos/core";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import { BirdeyeClient } from "./clients";
import { WalletPortfolioItem } from "./types";

export interface KeypairResult {
    keypair?: Keypair;
    publicKey?: PublicKey;
}

/**
 * Gets either a keypair or public key based on TEE mode and runtime settings
 * @param runtime The agent runtime
 * @param requirePrivateKey Whether to return a full keypair (true) or just public key (false)
 * @returns KeypairResult containing either keypair or public key
 */
export async function getWalletKey(
    runtime: IAgentRuntime,
    requirePrivateKey: boolean = true
): Promise<KeypairResult> {
    // TEE mode is OFF
    if (requirePrivateKey) {
        const privateKeyString =
            runtime.getSetting("SOLANA_PRIVATE_KEY") ??
            runtime.getSetting("WALLET_PRIVATE_KEY");

        if (!privateKeyString) {
            throw new Error("Private key not found in settings");
        }

        try {
            // First try base58
            const secretKey = bs58.decode(privateKeyString);
            return { keypair: Keypair.fromSecretKey(secretKey) };
        } catch (e) {
            elizaLogger.log("Error decoding base58 private key:", e);
            try {
                // Then try base64
                elizaLogger.log("Try decoding base64 instead");
                const secretKey = Uint8Array.from(
                    Buffer.from(privateKeyString, "base64")
                );
                return { keypair: Keypair.fromSecretKey(secretKey) };
            } catch (e2) {
                elizaLogger.error("Error decoding private key: ", e2);
                throw new Error("Invalid private key format");
            }
        }
    } else {
        const publicKeyString =
            runtime.getSetting("SOLANA_PUBLIC_KEY") ??
            runtime.getSetting("WALLET_PUBLIC_KEY");

        if (!publicKeyString) {
            throw new Error("Public key not found in settings");
        }

        return { publicKey: new PublicKey(publicKeyString) };
    }
}


// Provider configuration
const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    GRAPHQL_ENDPOINT: "https://graph.codex.io/graphql",
    TOKEN_ADDRESSES: {
        SOL: "So11111111111111111111111111111111111111112",
        BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
        ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    },
};

export interface Item {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    balance: string;
    uiAmount: string;
    priceUsd: string;
    valueUsd: string;
    valueSol?: string;
}

interface WalletPortfolio {
    totalUsd: string;
    totalSol?: string;
    items: Array<Item>;
}

interface _BirdEyePriceData {
    data: {
        [key: string]: {
            price: number;
            priceChange24h: number;
        };
    };
}

interface Prices {
    solana: { usd: string };
    bitcoin: { usd: string };
    ethereum: { usd: string };
}

export async function sendTransaction(
    connection: Connection,
    transaction: VersionedTransaction
) {
    console.log("Sending transaction...");

    const latestBlockhash = await connection.getLatestBlockhash();

    const txid = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
    });

    console.log("Transaction sent:", txid);

    // Confirm transaction using the blockhash
    const confirmation = await connection.confirmTransaction(
        {
            signature: txid,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
    );

    if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return txid;
}

export class WalletProvider {
    static createFromRuntime(runtime: IAgentRuntime): WalletProvider {
        const address = runtime.getSetting("SOLANA_PUBLIC_KEY");

        if (!address) {
            throw new Error("SOLANA_PUBLIC_KEY not configured");
        }

        return new this(runtime, new PublicKey(address));
    }

    constructor(
        private runtime: IAgentRuntime,
        public readonly publicKey: PublicKey
    ) {}

    async getAccountBalance(): Promise<bigint> {
        try {
            // Create a connection to the Solana network
            const connection = new Connection(
                this.runtime.getSetting("SOLANA_RPC_URL") ||
                    "https://api.mainnet-beta.solana.com",
                "confirmed"
            );

            // Fetch the balance for the wallet's public key
            const balance = await connection.getBalance(this.publicKey);

            // Return the balance in lamports as a bigint
            return BigInt(balance);
        } catch (error) {
            console.error("Error fetching account balance:", error);
            throw new Error("Failed to fetch account balance");
        }
    }

    async getFormattedPortfolio(): Promise<string> {
        try {
            const [portfolio, prices] = await Promise.all([
                this.fetchPortfolioValue(),
                BirdeyeClient.createFromRuntime(this.runtime).fetchPrices(),
            ]);

            return this.formatPortfolio(portfolio, prices);
        } catch (error) {
            console.error("Error generating portfolio report:", error);
            return "Unable to fetch wallet information. Please try again later.";
        }
    }

    async fetchPortfolioValue(): Promise<WalletPortfolio> {
        return await BirdeyeClient.createFromRuntime(
            this.runtime
        ).fetchPortfolioValue(this.publicKey.toBase58(), {
            chain: "solana",
            expires: "5m", // TODO: configure this
        });
    }

    async getTokensInWallet(): Promise<WalletPortfolioItem[]> {
        const walletInfo = await this.fetchPortfolioValue();
        return walletInfo.items;
    }

    // check if the token symbol is in the wallet
    async getTokenFromWallet(tokenSymbol: string) {
        try {
            const items = await this.getTokensInWallet();
            const token = items.find((item) => item.symbol === tokenSymbol);

            if (token) {
                return token.address;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error checking token in wallet:", error);
            return null;
        }
    }

    formatPortfolio(portfolio: WalletPortfolio, prices: Prices): string {
        let output = "";
        output += `Wallet Address: ${this.publicKey.toBase58()}\n\n`;

        const totalUsdFormatted = new BigNumber(portfolio.totalUsd).toFixed(2);
        const totalSolFormatted = portfolio.totalSol;

        output += `Total Value: $${totalUsdFormatted} (${totalSolFormatted} SOL)\n\n`;
        output += "Token Balances:\n";

        const nonZeroItems = portfolio.items.filter((item) =>
            new BigNumber(item.uiAmount).isGreaterThan(0)
        );

        if (nonZeroItems.length === 0) {
            output += "No tokens found with non-zero balance\n";
        } else {
            for (const item of nonZeroItems) {
                const valueUsd = new BigNumber(item.valueUsd).toFixed(2);
                output += `${item.name} (${item.symbol}): ${new BigNumber(
                    item.uiAmount
                ).toFixed(6)} ($${valueUsd} | ${item.valueSol} SOL)\n`;
            }
        }

        output += "\nMarket Prices:\n";
        output += `SOL: $${new BigNumber(prices.solana.usd).toFixed(2)}\n`;
        output += `BTC: $${new BigNumber(prices.bitcoin.usd).toFixed(2)}\n`;
        output += `ETH: $${new BigNumber(prices.ethereum.usd).toFixed(2)}\n`;

        return output;
    }
}

export const walletProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string | null> => {
        try {
            const provider = WalletProvider.createFromRuntime(runtime);
            return await provider.getFormattedPortfolio();
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};