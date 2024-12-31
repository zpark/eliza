import { ICacheManager, settings } from "@elizaos/core";
import NodeCache from "node-cache";
import * as path from "path";
import {
    API_BASE_URL,
    BIRDEYE_ENDPOINTS,
    DEFAULT_MAX_RETRIES,
    DEFAULT_SUPPORTED_SYMBOLS,
    RETRY_DELAY_MS,
} from "./constants";
import { BirdeyeApiParams, BirdeyeApiResponse } from "./types/api/common";
import {
    BaseQuoteParams,
    BaseQuoteResponse,
    DefiHistoryPriceParams,
    DefiHistoryPriceResponse,
    DefiMultiPriceParams,
    DefiMultiPriceParamsPOST,
    DefiMultiPriceResponse,
    DefiNetworksResponse,
    DefiPriceParams,
    DefiPriceResponse,
    DefiTradesTokenParams,
    DefiTradesTokenResponse,
    HistoricalPriceUnixParams,
    HistoricalPriceUnixResponse,
    MultiPriceVolumeParams,
    MultiPriceVolumeResponse,
    OHLCVParams,
    OHLCVResponse,
    PriceVolumeParams,
    PriceVolumeResponse,
} from "./types/api/defi";
import {
    OHLCVPairParams,
    OHLCVPairResponse,
    PairOverviewMultiParams,
    PairOverviewMultiResponse,
    PairOverviewSingleParams,
    PairOverviewSingleResponse,
    PairTradesParams,
    PairTradesResponse,
} from "./types/api/pair";
import {
    TokenMarketSearchParams,
    TokenMarketSearchResponse,
} from "./types/api/search";
import {
    AllMarketsParams,
    AllMarketsResponse,
    MintBurnParams,
    MintBurnResponse,
    NewListingParams,
    NewListingResponse,
    TokenCreationInfoParams,
    TokenCreationInfoResponse,
    TokenHoldersParams,
    TokenHoldersResponse,
    TokenListParams,
    TokenListResponse,
    TokenListV2Response,
    TokenMarketDataParams,
    TokenMarketDataResponse,
    TokenMetadataMultiParams,
    TokenMetadataMultiResponse,
    TokenMetadataSingleParams,
    TokenMetadataSingleResponse,
    TokenOverviewParams,
    TokenOverviewResponse,
    TokenSecurityParams,
    TokenSecurityResponse,
    TokenTradeDataMultiParams,
    TokenTradeDataMultiResponse,
    TokenTradeDataSingleParams,
    TokenTradeDataSingleResponse,
    TokenTrendingParams,
    TokenTrendingResponse,
    TopTradersParams,
    TopTradersResponse,
} from "./types/api/token";
import {
    GainersLosersParams,
    GainersLosersResponse,
    TraderTransactionsSeekParams,
    TraderTransactionsSeekResponse,
} from "./types/api/trader";
import {
    WalletPortfolioMultichainParams,
    WalletPortfolioMultichainResponse,
    WalletPortfolioParams,
    WalletPortfolioResponse,
    WalletSimulationParams,
    WalletSimulationResponse,
    WalletTokenBalanceParams,
    WalletTokenBalanceResponse,
    WalletTransactionHistoryMultichainParams,
    WalletTransactionHistoryMultichainResponse,
    WalletTransactionHistoryParams,
    WalletTransactionHistoryResponse,
} from "./types/api/wallet";
import { convertToStringParams, waitFor } from "./utils";

type FetchParams<T> = T & {
    headers?: Record<string, string>;
};

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

    /*
     * COMMON FETCH FUNCTIONS
     */
    private async fetchWithRetry<T extends BirdeyeApiResponse>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        let attempts = 0;

        // allow the user to override the chain
        const chain =
            options.headers?.["x-chain"] || settings.BIRDEYE_CHAIN || "solana";

        while (attempts < this.maxRetries) {
            attempts++;
            try {
                const resp = await fetch(url, {
                    ...options,
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-chain": chain,
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

                const rawData = await resp.json();
                // If the response already has data and success fields, return it
                if (
                    rawData.data !== undefined &&
                    rawData.success !== undefined
                ) {
                    return rawData as T;
                }
                // Otherwise wrap the response in the expected format
                return {
                    data: rawData,
                    success: true,
                } as T;
            } catch (error) {
                if (attempts === this.maxRetries) {
                    // failed after all
                    throw error;
                }
                await waitFor(RETRY_DELAY_MS);
            }
        }
    }

    private async fetchWithCacheAndRetry<T extends BirdeyeApiResponse>({
        url,
        params,
        headers,
        method = "GET",
    }: {
        url: string;
        params?: BirdeyeApiParams;
        headers?: Record<string, string>;
        method?: "GET" | "POST";
    }): Promise<T> {
        const stringParams = convertToStringParams(params);
        const fullUrl = `${API_BASE_URL}${url}`;
        const cacheKey =
            method === "GET"
                ? `${url}?${new URLSearchParams(stringParams)}`
                : `${url}:${JSON.stringify(params)}`;

        const val = await this.readFromCache(cacheKey);
        if (val) return val as T;

        const data = await this.fetchWithRetry<T>(
            method === "GET" && params
                ? `${fullUrl}?${new URLSearchParams(stringParams)}`
                : fullUrl,
            {
                method,
                headers,
                ...(method === "POST" &&
                    params && { body: JSON.stringify(params) }),
            }
        );

        await this.writeToCache(cacheKey, data);
        return data as T;
    }

    /*
     * DEFI FETCH FUNCTIONS
     */

    // Get a list of all supported networks.
    public async fetchDefiSupportedNetworks() {
        return this.fetchWithCacheAndRetry<DefiNetworksResponse>({
            url: BIRDEYE_ENDPOINTS.defi.networks,
        });
    }

    // Get price update of a token.
    public async fetchDefiPrice(params: FetchParams<DefiPriceParams>) {
        return this.fetchWithCacheAndRetry<DefiPriceResponse>({
            url: BIRDEYE_ENDPOINTS.defi.price,
            params,
            headers: params.headers,
        });
    }

    // Get price updates of multiple tokens in a single API call. Maximum 100 tokens
    public async fetchDefiPriceMultiple(
        params: FetchParams<DefiMultiPriceParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiMultiPriceResponse>({
            url: BIRDEYE_ENDPOINTS.defi.price_multi,
            params,
            headers: params.headers,
        });
    }

    // Get price updates of multiple tokens in a single API call. Maximum 100 tokens
    public async fetchDefiPriceMultiple_POST(
        params: FetchParams<DefiMultiPriceParamsPOST>
    ) {
        return this.fetchWithCacheAndRetry<DefiMultiPriceResponse>({
            url: BIRDEYE_ENDPOINTS.defi.price_multi_POST,
            params,
            headers: params.headers,
            method: "POST",
        });
    }

    // Get historical price line chart of a token.
    public async fetchDefiPriceHistorical(
        params: FetchParams<DefiHistoryPriceParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiHistoryPriceResponse>({
            url: BIRDEYE_ENDPOINTS.defi.history_price,
            params,
            headers: params.headers,
        });
    }

    // Get historical price by unix timestamp
    public async fetchDefiPriceHistoricalByUnixTime(
        params: FetchParams<HistoricalPriceUnixParams>
    ) {
        return this.fetchWithCacheAndRetry<HistoricalPriceUnixResponse>({
            url: BIRDEYE_ENDPOINTS.defi.historical_price_unix,
            params,
            headers: params.headers,
        });
    }

    // Get list of trades of a certain token.
    public async fetchDefiTradesToken(
        params: FetchParams<DefiTradesTokenParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiTradesTokenResponse>({
            url: BIRDEYE_ENDPOINTS.defi.trades_token,
            params,
            headers: params.headers,
        });
    }

    // Get list of trades of a certain pair or market.
    public async fetchDefiTradesPair(
        params: FetchParams<DefiTradesTokenParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiTradesTokenResponse>({
            url: BIRDEYE_ENDPOINTS.defi.trades_token,
            params,
            headers: params.headers,
        });
    }

    // Get list of trades of a token with time bound option.
    public async fetchDefiTradesTokenSeekByTime(
        params: FetchParams<DefiTradesTokenParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiTradesTokenResponse>({
            url: BIRDEYE_ENDPOINTS.defi.trades_token_seek,
            params,
            headers: params.headers,
        });
    }

    // Get list of trades of a certain pair or market with time bound option.
    public async fetchDefiTradesPairSeekByTime(
        params: FetchParams<DefiTradesTokenParams>
    ) {
        return this.fetchWithCacheAndRetry<DefiTradesTokenResponse>({
            url: BIRDEYE_ENDPOINTS.defi.trades_pair_seek,
            params,
            headers: params.headers,
        });
    }

    // Get OHLCV price of a token.
    public async fetchDefiOHLCV(params: FetchParams<OHLCVParams>) {
        return this.fetchWithCacheAndRetry<OHLCVResponse>({
            url: BIRDEYE_ENDPOINTS.defi.ohlcv,
            params,
            headers: params.headers,
        });
    }

    // Get OHLCV price of a pair.
    public async fetchDefiOHLCVPair(params: FetchParams<OHLCVPairParams>) {
        return this.fetchWithCacheAndRetry<OHLCVPairResponse>({
            url: BIRDEYE_ENDPOINTS.defi.ohlcv_pair,
            params,
            headers: params.headers,
        });
    }

    // Get OHLCV price of a base-quote pair.
    public async fetchDefiOHLCVBaseQuote(params: FetchParams<BaseQuoteParams>) {
        return this.fetchWithCacheAndRetry<BaseQuoteResponse>({
            url: BIRDEYE_ENDPOINTS.defi.ohlcv_base_quote,
            params,
            headers: params.headers,
        });
    }

    // Get price and volume of a token.
    public async fetchDefiPriceVolume(params: FetchParams<PriceVolumeParams>) {
        return this.fetchWithCacheAndRetry<PriceVolumeResponse>({
            url: BIRDEYE_ENDPOINTS.defi.price_volume,
            params,
            headers: params.headers,
        });
    }

    // Get price and volume updates of maximum 50 tokens
    public async fetchDefiPriceVolumeMulti_POST(
        params: FetchParams<MultiPriceVolumeParams>
    ) {
        return this.fetchWithCacheAndRetry<MultiPriceVolumeResponse>({
            url: BIRDEYE_ENDPOINTS.defi.price_volume_multi_POST,
            params,
            headers: params.headers,
            method: "POST",
        });
    }

    /*
     * TOKEN FETCH FUNCTIONS
     */

    // Get token list of any supported chains.
    public async fetchTokenList(params: FetchParams<TokenListParams>) {
        return this.fetchWithCacheAndRetry<TokenListResponse>({
            url: BIRDEYE_ENDPOINTS.token.list_all,
            params,
            headers: params.headers,
        });
    }

    // Get token security of any supported chains.
    public async fetchTokenSecurityByAddress(
        params: FetchParams<TokenSecurityParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenSecurityResponse>({
            url: BIRDEYE_ENDPOINTS.token.security,
            params,
            headers: params.headers,
        });
    }

    // Get overview of a token.
    public async fetchTokenOverview(params: FetchParams<TokenOverviewParams>) {
        return this.fetchWithCacheAndRetry<TokenOverviewResponse>({
            url: BIRDEYE_ENDPOINTS.token.overview,
            params,
            headers: params.headers,
        });
    }

    // Get creation info of token
    public async fetchTokenCreationInfo(
        params: FetchParams<TokenCreationInfoParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenCreationInfoResponse>({
            url: BIRDEYE_ENDPOINTS.token.creation_info,
            params,
            headers: params.headers,
        });
    }

    // Retrieve a dynamic and up-to-date list of trending tokens based on specified sorting criteria.
    public async fetchTokenTrending(params?: FetchParams<TokenTrendingParams>) {
        return this.fetchWithCacheAndRetry<TokenTrendingResponse>({
            url: BIRDEYE_ENDPOINTS.token.trending,
            params,
            headers: params?.headers,
        });
    }

    // This endpoint facilitates the retrieval of a list of tokens on a specified blockchain network. This upgraded version is exclusive to business and enterprise packages. By simply including the header for the requested blockchain without any query parameters, business and enterprise users can get the full list of tokens on the specified blockchain in the URL returned in the response. This removes the need for the limit response of the previous version and reduces the workload of making multiple calls.
    public async fetchTokenListV2_POST(
        params: FetchParams<Record<string, never>>
    ) {
        return this.fetchWithCacheAndRetry<TokenListV2Response>({
            url: BIRDEYE_ENDPOINTS.token.list_all_v2_POST,
            params,
            headers: params.headers,
            method: "POST",
        });
    }

    // Get newly listed tokens of any supported chains.
    public async fetchTokenNewListing(params?: FetchParams<NewListingParams>) {
        return this.fetchWithCacheAndRetry<NewListingResponse>({
            url: BIRDEYE_ENDPOINTS.token.new_listing,
            params,
            headers: params?.headers,
        });
    }

    // Get top traders of given token.
    public async fetchTokenTopTraders(params: FetchParams<TopTradersParams>) {
        return this.fetchWithCacheAndRetry<TopTradersResponse>({
            url: BIRDEYE_ENDPOINTS.token.top_traders,
            params,
            headers: params.headers,
        });
    }

    // The API provides detailed information about the markets for a specific cryptocurrency token on a specified blockchain. Users can retrieve data for one or multiple markets related to a single token. This endpoint requires the specification of a token address and the blockchain to filter results. Additionally, it supports optional query parameters such as offset, limit, and required sorting by liquidity or sort type (ascending or descending) to refine the output.
    public async fetchTokenAllMarketsList(
        params: FetchParams<AllMarketsParams>
    ) {
        return this.fetchWithCacheAndRetry<AllMarketsResponse>({
            url: BIRDEYE_ENDPOINTS.token.all_markets,
            params,
            headers: params.headers,
        });
    }

    // Get metadata of single token
    public async fetchTokenMetadataSingle(
        params: FetchParams<TokenMetadataSingleParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenMetadataSingleResponse>({
            url: BIRDEYE_ENDPOINTS.token.metadata_single,
            params,
            headers: params.headers,
        });
    }

    // Get metadata of multiple tokens
    public async fetchTokenMetadataMulti(
        params: FetchParams<TokenMetadataMultiParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenMetadataMultiResponse>({
            url: BIRDEYE_ENDPOINTS.token.metadata_multi,
            params,
            headers: params.headers,
        });
    }

    // Get market data of single token
    public async fetchTokenMarketData(
        params: FetchParams<TokenMarketDataParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenMarketDataResponse>({
            url: BIRDEYE_ENDPOINTS.token.market_data,
            params,
            headers: params.headers,
        });
    }

    // Get trade data of single token
    public async fetchTokenTradeDataSingle(
        params: FetchParams<TokenTradeDataSingleParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenTradeDataSingleResponse>({
            url: BIRDEYE_ENDPOINTS.token.trade_data_single,
            params,
            headers: params.headers,
        });
    }

    // Get trade data of multiple tokens
    public async fetchTokenTradeDataMultiple(
        params: FetchParams<TokenTradeDataMultiParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenTradeDataMultiResponse>({
            url: BIRDEYE_ENDPOINTS.token.trade_data_multi,
            params,
            headers: params.headers,
        });
    }

    // Get top holder list of the given token
    public async fetchTokenHolders(params: FetchParams<TokenHoldersParams>) {
        return this.fetchWithCacheAndRetry<TokenHoldersResponse>({
            url: BIRDEYE_ENDPOINTS.token.holders,
            params,
            headers: params.headers,
        });
    }

    // Get mint/burn transaction list of the given token. Only support solana currently
    public async fetchTokenMintBurn(params: FetchParams<MintBurnParams>) {
        return this.fetchWithCacheAndRetry<MintBurnResponse>({
            url: BIRDEYE_ENDPOINTS.token.mint_burn,
            params,
            headers: params.headers,
        });
    }

    /*
     * WALLET FETCH FUNCTIONS
     */
    public async fetchWalletSupportedNetworks(
        params?: FetchParams<Record<string, never>>
    ) {
        return this.fetchWithCacheAndRetry<DefiNetworksResponse>({
            url: BIRDEYE_ENDPOINTS.defi.networks,
            headers: params?.headers,
        });
    }

    public async fetchWalletPortfolio(
        params: FetchParams<WalletPortfolioParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletPortfolioResponse>({
            url: BIRDEYE_ENDPOINTS.wallet.portfolio,
            params,
            headers: params.headers,
        });
    }

    /**
     * @deprecated This endpoint will be decommissioned on Feb 1st, 2025.
     */
    public async fetchWalletPortfolioMultichain(
        params: FetchParams<WalletPortfolioMultichainParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletPortfolioMultichainResponse>({
            url: BIRDEYE_ENDPOINTS.wallet.portfolio_multichain,
            params,
            headers: params.headers,
        });
    }

    public async fetchWalletTokenBalance(
        params: FetchParams<WalletTokenBalanceParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletTokenBalanceResponse>({
            url: BIRDEYE_ENDPOINTS.wallet.token_balance,
            params,
            headers: params.headers,
        });
    }

    public async fetchWalletTransactionHistory(
        params: FetchParams<WalletTransactionHistoryParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletTransactionHistoryResponse>({
            url: BIRDEYE_ENDPOINTS.wallet.transaction_history,
            params,
            headers: params.headers,
        });
    }

    /**
     * @deprecated This endpoint will be decommissioned on Feb 1st, 2025.
     */
    public async fetchWalletTransactionHistoryMultichain(
        params: FetchParams<WalletTransactionHistoryMultichainParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletTransactionHistoryMultichainResponse>(
            {
                url: BIRDEYE_ENDPOINTS.wallet.transaction_history_multichain,
                params,
                headers: params.headers,
            }
        );
    }

    public async fetchWalletTransactionSimulate_POST(
        params: FetchParams<WalletSimulationParams>
    ) {
        return this.fetchWithCacheAndRetry<WalletSimulationResponse>({
            url: BIRDEYE_ENDPOINTS.wallet.transaction_simulation_POST,
            params,
            headers: params.headers,
            method: "POST",
        });
    }

    /*
     * TRADER FETCH FUNCTIONS
     */

    // The API provides detailed information top gainers/losers
    public async fetchTraderGainersLosers(
        params: FetchParams<GainersLosersParams>
    ) {
        return this.fetchWithCacheAndRetry<GainersLosersResponse>({
            url: BIRDEYE_ENDPOINTS.trader.gainers_losers,
            params,
            headers: params.headers,
        });
    }

    // Get list of trades of a trader with time bound option.
    public async fetchTraderTransactionsSeek(
        params: FetchParams<TraderTransactionsSeekParams>
    ) {
        return this.fetchWithCacheAndRetry<TraderTransactionsSeekResponse>({
            url: BIRDEYE_ENDPOINTS.trader.trades_seek,
            params,
            headers: params.headers,
        });
    }

    /*
     * PAIR FETCH FUNCTIONS
     */
    public async fetchPairOverviewSingle(
        params: FetchParams<PairOverviewSingleParams>
    ) {
        return this.fetchWithCacheAndRetry<PairOverviewSingleResponse>({
            url: BIRDEYE_ENDPOINTS.pair.overview_single,
            params,
            headers: params.headers,
        });
    }

    // Get overview of multiple pairs
    public async fetchMultiPairOverview(
        params: FetchParams<PairOverviewMultiParams>
    ) {
        return this.fetchWithCacheAndRetry<PairOverviewMultiResponse>({
            url: BIRDEYE_ENDPOINTS.pair.overview_multi,
            params,
            headers: params.headers,
        });
    }

    public async fetchPairOverviewMultiple(
        params: FetchParams<PairTradesParams>
    ) {
        return this.fetchWithCacheAndRetry<PairTradesResponse>({
            url: BIRDEYE_ENDPOINTS.defi.trades_pair,
            params,
            headers: params.headers,
        });
    }

    /*
     * SEARCH FETCH FUNCTIONS
     */
    public async fetchSearchTokenMarketData(
        params: FetchParams<TokenMarketSearchParams>
    ) {
        return this.fetchWithCacheAndRetry<TokenMarketSearchResponse>({
            url: BIRDEYE_ENDPOINTS.search.token_market,
            params,
            headers: params.headers,
        });
    }
}
