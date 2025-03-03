import {
    logger,
    type Client,
    type IAgentRuntime
} from '@elizaos/core';
import { Connection, PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { SOLANA_CLIENT_NAME, SOLANA_WALLET_DATA_CACHE_KEY } from './constants';
import { getWalletKey } from './keypairUtils';
import type { ISolanaClient, Item, Prices, WalletPortfolio } from './types';

const PROVIDER_CONFIG = {
    BIRDEYE_API: 'https://public-api.birdeye.so',
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: 'https://api.mainnet-beta.solana.com',
    TOKEN_ADDRESSES: {
        SOL: 'So11111111111111111111111111111111111111112',
        BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
        ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    },
};

export class SolanaClient implements ISolanaClient, Client {
    private updateInterval: NodeJS.Timer | null = null;
    private lastUpdate = 0;
    private readonly UPDATE_INTERVAL = 120000; // 2 minutes
    private connection: Connection;
    private publicKey: PublicKey;
    name: string = SOLANA_CLIENT_NAME;

    constructor(
        private runtime: IAgentRuntime,
        connection: Connection,
        publicKey: PublicKey,
    ) {
        this.connection = connection;
        this.publicKey = publicKey;
    }

    static async start(runtime: IAgentRuntime) {
        logger.log('initSolanaClient');

        const connection = new Connection(
            runtime.getSetting('SOLANA_RPC_URL') || PROVIDER_CONFIG.DEFAULT_RPC,
        );

        const { publicKey } = await getWalletKey(runtime, false);

        const solanaClient = new SolanaClient(runtime, connection, publicKey);

        logger.log('SolanaClient start');
        if (solanaClient.updateInterval) {
            clearInterval(solanaClient.updateInterval);
        }

        solanaClient.updateInterval = setInterval(async () => {
            logger.log('Updating wallet data');
            await solanaClient.updateWalletData();
        }, solanaClient.UPDATE_INTERVAL);

        // Initial update
        solanaClient.updateWalletData().catch(console.error);
    }

    static async stop(runtime: IAgentRuntime) {
        const client = runtime.getClient(SOLANA_CLIENT_NAME);
        if (!client) {
            logger.error('SolanaClient not found');
            return;
        }
        if (client.updateInterval) {
            clearInterval(client.updateInterval);
            client.updateInterval = null;
        }

        runtime.unregisterClient(SOLANA_CLIENT_NAME);

        return Promise.resolve();
    }

    private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<any> {
        let lastError: Error;

        for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        Accept: 'application/json',
                        'x-chain': 'solana',
                        'X-API-KEY': this.runtime.getSetting('BIRDEYE_API_KEY'),
                        ...options.headers,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `HTTP error! status: ${response.status}, message: ${errorText}`,
                    );
                }

                return await response.json();
            } catch (error) {
                logger.error(`Attempt ${i + 1} failed:`, error);
                lastError = error;
                if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, PROVIDER_CONFIG.RETRY_DELAY * 2 ** i),
                    );
                }
            }
        }

        throw lastError;
    }

    private async fetchPrices(): Promise<Prices> {
        const cacheKey = 'prices';
        const cachedValue = await this.runtime.databaseAdapter.getCache(cacheKey);

        // if cachedValue is JSON, parse it
        if (cachedValue) {
            logger.log('Cache hit for fetchPrices');
            return JSON.parse(cachedValue);
        }

        logger.log('Cache miss for fetchPrices');
        const { SOL, BTC, ETH } = PROVIDER_CONFIG.TOKEN_ADDRESSES;
        const tokens = [SOL, BTC, ETH];
        const prices: Prices = {
            solana: { usd: '0' },
            bitcoin: { usd: '0' },
            ethereum: { usd: '0' },
        };

        for (const token of tokens) {
            const response = await this.fetchWithRetry(
                `${PROVIDER_CONFIG.BIRDEYE_API}/defi/price?address=${token}`,
            );

            if (response?.data?.value) {
                const price = response.data.value.toString();
                prices[token === SOL ? 'solana' : token === BTC ? 'bitcoin' : 'ethereum'].usd =
                    price;
            }
        }

        await this.runtime.databaseAdapter.setCache(cacheKey, JSON.stringify(prices));
        return prices;
    }

    private async getTokenAccounts() {
        try {
            const accounts = await this.connection.getParsedTokenAccountsByOwner(this.publicKey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            });
            return accounts.value;
        } catch (error) {
            logger.error('Error fetching token accounts:', error);
            return [];
        }
    }

    private async updateWalletData(force = false): Promise<WalletPortfolio> {
        const now = Date.now();

        // Don't update if less than interval has passed, unless forced
        if (!force && now - this.lastUpdate < this.UPDATE_INTERVAL) {
            const cached = await this.getCachedData();
            if (cached) return cached;
        }

        try {
            // Try Birdeye API first
            const birdeyeApiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
            if (birdeyeApiKey) {
                const walletData = await this.fetchWithRetry(
                    `${
                        PROVIDER_CONFIG.BIRDEYE_API
                    }/v1/wallet/token_list?wallet=${this.publicKey.toBase58()}`,
                );

                if (walletData?.success && walletData?.data) {
                    const data = walletData.data;
                    const totalUsd = new BigNumber(data.totalUsd.toString());
                    const prices = await this.fetchPrices();
                    const solPriceInUSD = new BigNumber(prices.solana.usd);

                    const portfolio: WalletPortfolio = {
                        totalUsd: totalUsd.toString(),
                        totalSol: totalUsd.div(solPriceInUSD).toFixed(6),
                        prices,
                        lastUpdated: now,
                        items: data.items.map((item: any) => ({
                            ...item,
                            valueSol: new BigNumber(item.valueUsd || 0)
                                .div(solPriceInUSD)
                                .toFixed(6),
                            name: item.name || 'Unknown',
                            symbol: item.symbol || 'Unknown',
                            priceUsd: item.priceUsd || '0',
                            valueUsd: item.valueUsd || '0',
                        })),
                    };

                    await this.runtime.databaseAdapter.setCache(SOLANA_WALLET_DATA_CACHE_KEY, JSON.stringify(portfolio));
                    this.lastUpdate = now;
                    return portfolio;
                }
            }

            // Fallback to basic token account info
            const accounts = await this.getTokenAccounts();
            const items: Item[] = accounts.map((acc) => ({
                name: 'Unknown',
                address: acc.account.data.parsed.info.mint,
                symbol: 'Unknown',
                decimals: acc.account.data.parsed.info.tokenAmount.decimals,
                balance: acc.account.data.parsed.info.tokenAmount.amount,
                uiAmount: acc.account.data.parsed.info.tokenAmount.uiAmount.toString(),
                priceUsd: '0',
                valueUsd: '0',
                valueSol: '0',
            }));

            const portfolio: WalletPortfolio = {
                totalUsd: '0',
                totalSol: '0',
                items,
            };

            await this.runtime.databaseAdapter.setCache(SOLANA_WALLET_DATA_CACHE_KEY, JSON.stringify(portfolio));
            this.lastUpdate = now;
            return portfolio;
        } catch (error) {
            logger.error('Error updating wallet data:', error);
            throw error;
        }
    }

    public async getCachedData(): Promise<WalletPortfolio | null> {
        const cachedValue = await this.runtime.databaseAdapter.getCache(SOLANA_WALLET_DATA_CACHE_KEY);
        if (cachedValue) {
            return JSON.parse(cachedValue);
        }
        return null;
    }

    public async forceUpdate(): Promise<WalletPortfolio> {
        return await this.updateWalletData(true);
    }

    public getPublicKey(): PublicKey {
        return this.publicKey;
    }

    public getConnection(): Connection {
        return this.connection;
    }
}
