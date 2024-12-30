import { elizaLogger, ICacheManager, settings } from "@elizaos/core";
import NodeCache from "node-cache";
import * as path from "path";
import {
    API_BASE_URL,
    DEFAULT_MAX_RETRIES,
    DEFAULT_SUPPORTED_SYMBOLS,
    ENDPOINT_MAP,
    RETRY_DELAY_MS,
} from "./constants";
import { SearchTokenResponse, SearchTokensOptions } from "./types/search-token";
import { BirdeyeChain } from "./types/shared";
import { TokenMetadataResponse } from "./types/token-metadata";
import { WalletDataOptions, WalletDataResponse } from "./types/wallet";
import { waitFor } from "./utils";

class BaseCachedProvider {
    private cache: NodeCache;

    constructor(
        private cacheManager: ICacheManager,
        private cacheKey,
        ttl?: number
    ) {
        this.cache = new NodeCache({ stdTTL: ttl || 300 });
    }

    private readFsCache<T>(key: string): Promise<T | null> {
        return this.cacheManager.get<T>(path.join(this.cacheKey, key));
    }

    private writeFsCache<T>(key: string, data: T): Promise<void> {
        return this.cacheManager.set(path.join(this.cacheKey, key), data, {
            expires: Date.now() + 5 * 60 * 1000,
        });
    }

    public async readFromCache<T>(key: string): Promise<T | null> {
        // get memory cache first
        const val = this.cache.get<T>(key);
        if (val) {
            return val;
        }

        const fsVal = await this.readFsCache<T>(key);
        if (fsVal) {
            // set to memory cache
            this.cache.set(key, fsVal);
        }

        return fsVal;
    }

    public async writeToCache<T>(key: string, val: T): Promise<void> {
        // Set in-memory cache
        this.cache.set(key, val);

        // Write to file-based cache
        await this.writeFsCache(key, val);
    }
}

export class BirdeyeProvider extends BaseCachedProvider {
    private symbolMap: Record<string, string>;
    private maxRetries: number;

    constructor(
        cacheManager: ICacheManager,
        symbolMap?: Record<string, string>,
        maxRetries?: number
    ) {
        super(cacheManager, "birdeye/data");
        this.symbolMap = symbolMap || DEFAULT_SUPPORTED_SYMBOLS;
        this.maxRetries = maxRetries || DEFAULT_MAX_RETRIES;
    }

    public getTokenAddress(symbol: string) {
        const addr = this.symbolMap[symbol];

        if (!addr) {
            throw new Error(`Unsupported symbol ${symbol} in Birdeye provider`);
        }

        return addr;
    }

    private getUrlByType(type: string, address?: string) {
        const path = ENDPOINT_MAP[type];

        if (!path) {
            throw new Error(`Unsupported symbol ${type} in Birdeye provider`);
        }

        return `${API_BASE_URL}${path}${address || ""}`;
    }

    private async fetchWithRetry(
        url: string,
        options: RequestInit = {}
    ): Promise<any> {
        let attempts = 0;

        while (attempts < this.maxRetries) {
            attempts++;
            try {
                const resp = await fetch(url, {
                    ...options,
                    headers: {
                        Accept: "application/json",
                        "x-chain": settings.BIRDEYE_CHAIN || "solana",
                        "X-API-KEY": settings.BIRDEYE_API_KEY || "",
                        ...options.headers,
                    },
                });

                if (!resp.ok) {
                    const errorText = await resp.text();
                    throw new Error(
                        `HTTP error! status: ${resp.status}, message: ${errorText}`
                    );
                }

                const data = await resp.json();
                return data;
            } catch (error) {
                if (attempts === this.maxRetries) {
                    // failed after all
                    throw error;
                }
                await waitFor(RETRY_DELAY_MS);
            }
        }
    }

    private async fetchWithCacheAndRetry(
        type: string,
        address?: string
    ): Promise<any> {
        const key = `${type}/${address}`;
        const val = await this.readFromCache(key);

        if (val) {
            return val;
        }

        const url = this.getUrlByType(type, address);
        const data = await this.fetchWithRetry(url);

        await this.writeToCache(key, data);
        return data;
    }

    public async fetchTokenList() {
        return this.fetchWithCacheAndRetry("tokens");
    }

    public async fetchPriceBySymbol(symbol: string) {
        return this.fetchPriceByAddress(this.getTokenAddress(symbol));
    }
    public async fetchPriceByAddress(address: string) {
        return this.fetchWithCacheAndRetry("price", address);
    }

    public async fetchTokenSecurityBySymbol(symbol: string) {
        return this.fetchTokenSecurityByAddress(this.getTokenAddress(symbol));
    }
    public async fetchTokenSecurityByAddress(address: string) {
        return this.fetchWithCacheAndRetry("security", address);
    }

    public async fetchTokenTradeDataBySymbol(symbol: string) {
        return this.fetchTokenTradeDataByAddress(this.getTokenAddress(symbol));
    }
    public async fetchTokenTradeDataByAddress(address: string) {
        return this.fetchWithCacheAndRetry("volume", address);
    }

    public async fetchWalletPortfolio(address: string) {
        return this.fetchWithCacheAndRetry("portfolio", address);
    }

    /**
     * Fetches token data for a given keyword and chain.
     * @param options - The options for the token data.
     * @returns The token data.
     */
    public async fetchSearchTokens(
        options: SearchTokensOptions
    ): Promise<SearchTokenResponse | null> {
        const { keyword, chain = "all", limit = 1, offset = 0 } = options;
        const params = new URLSearchParams({
            keyword,
            limit: limit.toString(),
            offset: offset.toString(),
            chain: chain,
        });

        const url = `${API_BASE_URL}/defi/v3/search?${params.toString()}`;
        const response: SearchTokenResponse = await this.fetchWithRetry(url);
        return response;
    }

    /**
     * Fetches wallet portfolio data for a given wallet address and chains.
     * @param options - The options for the wallet portfolio data.
     * @returns The wallet portfolio data.
     */
    public async fetchSearchWallets(
        options: WalletDataOptions
    ): Promise<WalletDataResponse | null> {
        const { wallet, chain } = options;

        const params = new URLSearchParams({
            wallet,
        });

        const url = `${API_BASE_URL}/v1/wallet/token_list?${params.toString()}`;
        const response = await this.fetchWithRetry(url, {
            headers: { "x-chain": chain },
        });

        return response;
    }

    /**
     * Fetches token metadata for a given address and chain.
     * @param address - The address of the token.
     * @param chain - The chain of the token.
     * @returns The token metadata.
     */
    public async fetchTokenMetadata(
        address: string,
        chain: BirdeyeChain
    ): Promise<TokenMetadataResponse | null> {
        const isValidAddress = (() => {
            switch (chain) {
                case "solana":
                    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
                case "sui":
                    return /^0x[a-fA-F0-9]{64}$/i.test(address);
                case "ethereum":
                case "arbitrum":
                case "avalanche":
                case "bsc":
                case "optimism":
                case "polygon":
                case "base":
                case "zksync":
                    return /^0x[a-fA-F0-9]{40}$/i.test(address);
                default:
                    return false;
            }
        })();

        if (!isValidAddress) {
            elizaLogger.error(
                `Invalid address format for ${chain}: ${address}`
            );
            return null;
        }

        const params = new URLSearchParams({ address });
        const url = `${API_BASE_URL}/defi/v3/token/meta-data/single?${params.toString()}`;

        const response: TokenMetadataResponse = await this.fetchWithRetry(url, {
            headers: { "x-chain": chain },
        }).catch(() => null);

        if (!response) {
            elizaLogger.error(
                `Failed to fetch token metadata for ${address} on ${chain}`
            );
            return null;
        }

        return response;
    }
}
