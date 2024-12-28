import { elizaLogger } from "@elizaos/core";
import {
    SearchToken,
    SearchTokenResponse,
    SearchTokensOptions,
} from "./types/search-token";
import { BirdeyeChain } from "./types/shared";
import { TokenMetadataResponse } from "./types/token-metadata";
import {
    WalletDataItem,
    WalletDataOptions,
    WalletDataResponse,
} from "./types/wallet";
import { BASE_URL, makeApiRequest } from "./utils";

export const searchTokens = async (
    apiKey: string,
    options: SearchTokensOptions
): Promise<SearchToken[]> => {
    try {
        const { keyword, chain = "all", limit = 1, offset = 0, type } = options;

        const params = new URLSearchParams({
            keyword,
            limit: limit.toString(),
            offset: offset.toString(),
            chain: chain,
        });

        const url = `${BASE_URL}/defi/v3/search?${params.toString()}`;

        elizaLogger.info("Searching tokens from:", url);

        const response = await fetch(url, {
            headers: {
                "X-API-KEY": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as SearchTokenResponse;

        elizaLogger.info("Birdeye response:", data);

        // Extract tokens from the response
        // if the search type is address, we only want to return the token that matches the address
        const tokens =
            type === "address"
                ? data.data.items
                      .filter(
                          (item) =>
                              item.type === "token" &&
                              item.result[0].address === keyword.toLowerCase()
                      )
                      .flatMap((item) => item.result)
                : data.data.items
                      .filter((item) => item.type === "token")
                      .flatMap((item) => item.result);

        elizaLogger.info("Found tokens:", tokens);

        return tokens;
    } catch (error) {
        elizaLogger.error("Error searching tokens:", error);
        throw error;
    }
};

export const searchWallets = async (
    apiKey: string,
    options: WalletDataOptions
): Promise<WalletDataItem[]> => {
    try {
        const { wallet, chain = "solana" } = options;

        const params = new URLSearchParams({
            wallet,
            chain: chain,
        });

        const url = `${BASE_URL}/v1/wallet/token_list?${params.toString()}`;

        elizaLogger.info("Searching wallet data from:", url);

        const response = await fetch(url, {
            headers: {
                "X-API-KEY": apiKey,
                "x-chain": chain,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as WalletDataResponse;

        elizaLogger.info("Birdeye response:", data);

        // Extract tokens from the response
        // if the search type is address, we only want to return the token that matches the address
        const walletData = data.data.items;

        elizaLogger.info("Found wallet data:", walletData);

        return walletData;
    } catch (error) {
        elizaLogger.error("Error searching tokens:", error);
        throw error;
    }
};

export const getTokenMetadata = async (
    apiKey: string,
    address: string,
    chain: BirdeyeChain
): Promise<TokenMetadataResponse | null> => {
    try {
        // Validate address format based on chain
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

        const params = new URLSearchParams({
            address: address,
        });
        const url = `${BASE_URL}/defi/v3/token/meta-data/single?${params.toString()}`;

        elizaLogger.info(
            `Fetching token metadata for ${address} on ${chain} from:`,
            url
        );

        return await makeApiRequest<TokenMetadataResponse>(url, {
            apiKey,
            chain,
        });
    } catch (error) {
        if (error instanceof Error) {
            elizaLogger.error("Error fetching token metadata:", error.message);
        }
        return null;
    }
};
