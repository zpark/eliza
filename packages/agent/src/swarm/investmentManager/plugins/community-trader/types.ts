import { type Content, type Memory, stringToUuid, type UUID } from "@elizaos/core";
import type { MessageRecommendation } from "./recommendations/schema";

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Pretty<type> = { [key in keyof type]: type[key] } & unknown;

type ExtractVariables<T extends string> =
    T extends `${infer Start}{{${infer Var}}}${infer Rest}`
        ? Var | ExtractVariables<Rest>
        : never;

export type TemplateVariables<T extends string> = Pretty<{
    [K in ExtractVariables<T>]: string;
}>;

type SQLiteValue = string | number | null;

type ToSQLiteType<T> = T extends boolean
    ? number
    : T extends Date
      ? string
      : T extends bigint
        ? string
        : T extends Array<any>
          ? string
          : T extends object
            ? string
            : T extends SQLiteValue
              ? T
              : never;

export type ToSQLiteRecord<T extends Record<string, any>> = {
    [K in keyof T]: ToSQLiteType<T[K]>;
};

export type RecommenderMetricsRow = ToSQLiteRecord<RecommenderMetrics>;
export type TokenPerformanceRow = ToSQLiteRecord<TokenPerformance>;
export type PositionRow = ToSQLiteRecord<Position>;
export type TransactionRow = ToSQLiteRecord<Transaction>;

export type Recommender = {
    id: UUID;
    platform: string;
    userId: string;
    username: string;
    clientId?: string;
    msg?: string;
};

export type RecommenderMetrics = {
    recommenderId: UUID;
    trustScore: number;
    totalRecommendations: number;
    successfulRecs: number;
    avgTokenPerformance: number;
    riskScore: number;
    consistencyScore: number;
    virtualConfidence: number;
    lastActiveDate: Date;
    trustDecay: number;
    updatedAt: Date;
};

export type TokenPerformance = {
    chain: string;
    address: string;

    name: string;
    symbol: string;
    decimals: number;

    metadata: Record<string, any>;

    price: number;
    price24hChange: number;

    volume: number;
    volume24hChange: number;

    trades: number;
    trades24hChange: number;

    liquidity: number;
    // liquidity24hChange: number;

    holders: number;
    holders24hChange: number;

    initialMarketCap: number;
    currentMarketCap: number;
    // marketCap24hChange: number;

    rugPull: boolean;
    isScam: boolean;
    sustainedGrowth: boolean;
    rapidDump: boolean;
    suspiciousVolume: boolean;
    validationTrust: number;

    createdAt: Date;
    updatedAt: Date;
};

export type TokenRecommendation = {
    id: UUID;
    recommenderId: UUID;
    chain: string;
    tokenAddress: string;

    conviction: "NONE" | "LOW" | "MEDIUM" | "HIGH";
    type: "BUY" | "DONT_BUY" | "SELL" | "DONT_SELL" | "NONE";

    initialMarketCap: string;
    initialLiquidity: string;
    initialPrice: string;

    marketCap: string;
    liquidity: string;
    price: string;

    rugPull: boolean;
    isScam: boolean;
    riskScore: number;
    performanceScore: number;

    metadata: Record<string, any>;

    status: "ACTIVE" | "COMPLETED" | "EXPIRED" | "WITHDRAWN";
    // statusReason?: string;
    // completedAt: Date;

    createdAt: Date;
    updatedAt: Date;
};

export type RecommenderMetricsHistory = {
    historyId: UUID;
    recommenderId: string;

    // max 100, min -100; +1/10 on the performace score when closing position - 1/10 riskScore

    trustScore: number;

    totalRecommendations: number;

    successfulRecs: number; // performance score > 0

    avgTokenPerformance: number; // avg(performance)
    riskScore: number; // avg(riskscore)

    consistencyScore: number; // successfulRecs / totalRecommendations
    virtualConfidence: number; //

    trustDecay: number;

    recordedAt: Date;
};

export type Position = {
    id: UUID;
    chain: string;
    tokenAddress: string;
    walletAddress: string;

    isSimulation: boolean;

    recommenderId: UUID;
    recommendationId: UUID;

    initialPrice: string;
    initialMarketCap: string;
    initialLiquidity: string;

    performanceScore: number;

    rapidDump: boolean;
    openedAt: Date;
    closedAt?: Date;
    updatedAt: Date;
};

export type PositionWithBalance = Position & {
    balance: bigint;
};

export type Transaction = {
    id: UUID;
    type: "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT";
    positionId: UUID;
    isSimulation: boolean;

    chain: string;
    tokenAddress: string;
    transactionHash: string;
    //
    amount: bigint;
    valueUsd?: string;
    price?: string;
    //
    solAmount?: bigint;
    solValueUsd?: string;
    solPrice?: string;
    //
    marketCap?: string;
    liquidity?: string;

    timestamp: Date;
};

export type SellDetails = {
    price: number;
    timestamp: string;
    amount: bigint;
    receivedSol: bigint;
    valueUsd: number;
    profitUsd: number;
    profitPercent: number;
    marketCap: number;
    marketCapChange: number;
    liquidity: number;
    liquidityChange: number;
    rapidDump: boolean;
    recommenderId: string;
};

export interface TrustScoreAdapter {
    // Recommender Methods
    addRecommender(recommender: Recommender): Promise<string | null>;
    getRecommender(identifier: string): Promise<Recommender | null>;
    getOrCreateRecommender(recommender: Recommender): Promise<Recommender>;
    getOrCreateRecommenderWithDiscordId(
        discordId: string
    ): Promise<Recommender | null>;
    getOrCreateRecommenderWithTelegramId(
        telegramId: string
    ): Promise<Recommender | null>;

    // Recommender Metrics Methods
    initializeRecommenderMetrics(recommenderId: UUID): Promise<boolean>;
    getRecommenderMetrics(
        recommenderId: UUID
    ): Promise<RecommenderMetrics | null>;
    updateRecommenderMetrics(metrics: RecommenderMetrics): Promise<void>;
    logRecommenderMetricsHistory(recommenderId: UUID): Promise<void>;
    getRecommenderMetricsHistory(
        recommenderId: UUID
    ): Promise<RecommenderMetricsHistory[]>;

    // Token Performance Methods
    upsertTokenPerformance(performance: TokenPerformance): Promise<boolean>;
    getTokenPerformance(tokenAddress: string): Promise<TokenPerformance | null>;
    calculateValidationTrust(tokenAddress: string): Promise<number>;

    // Token Recommendations Methods
    addTokenRecommendation(
        recommendation: TokenRecommendation
    ): Promise<boolean>;
    getRecommendationsByRecommender(
        recommenderId: UUID
    ): Promise<TokenRecommendation[]>;
    getRecommendationsByToken(
        tokenAddress: string
    ): Promise<TokenRecommendation[]>;
    getRecommendationsByDateRange(
        startDate: Date,
        endDate: Date
    ): Promise<TokenRecommendation[]>;

    // // Trade Performance Methods
    // addTradePerformance(trade: TradePerformance): Promise<boolean>;
    // updateTradePerformanceOnSell(props: {
    //     tradePerformanceId: string;
    //     tokenAddress: string;
    //     recommenderId: UUID;
    //     sellDetails: SellDetails;
    // }): Promise<boolean>;
    // getTradePerformance(
    //     tokenAddress: string,
    //     recommenderId: string,
    //     buyTimestamp: string,
    //     isSimulation: boolean
    // ): Promise<TradePerformance | null>;
    // getLatestTradePerformance(
    //     tokenAddress: string,
    //     recommenderId: string,
    //     isSimulation: boolean
    // ): Promise<TradePerformance | null>;

    // Transaction Methods
    addTransaction(transaction: Transaction): Promise<boolean>;
    getTransactionsByToken(tokenAddress: string): Promise<Transaction[]>;

    // Cleanup
    close(): Promise<void>;
}

export type BuyData = {
    positionId: UUID;
    chain: string;
    tokenAddress: string;
    walletAddress: string;
    recommender: Recommender;
    recommendationId: UUID;
    solAmount: bigint;
    buyAmount: bigint;
    timestamp: Date;
    initialTokenPriceUsd: string;
    isSimulation: boolean;
    txHash: string;
};

export type SellData = {
    positionId: UUID;
    chain: string;
    tokenAddress: string;
    walletAddress: string;
    recommender: Recommender;
    solAmount: bigint;
    sellAmount: bigint;
    timestamp: Date;
    isSimulation: boolean;
    txHash: string;
};

export type RecommenderAnalytics = {
    recommenderId: string;
    trustScore: number;
    riskScore: number;
    consistencyScore: number;
    recommenderMetrics: RecommenderMetrics;
};

export type TokenRecommendationSummary = {
    chain: string;
    tokenAddress: string;
    averageTrustScore: number;
    averageRiskScore: number;
    averageConsistencyScore: number;
    recommenders: RecommenderAnalytics[];
};

export type TransactionData = {
    chain: string;
    tokenAddress: string;
    pairId: string;
    amount: string;
    currentBalance: string;
    sellRecommenderId: string;
    walletAddress: string;
    transaction: any | null;
    isSimulation: boolean;
};

export type QuoteResult<Data = any> = {
    amountOut: bigint;
    data?: Data;
};

export type SwapInResult<Data = any> = {
    txHash: string;
    amountOut: bigint;
    timestamp: Date;
    data?: Data;
};

export type QuoteInParams = {
    inputToken: string;
    outputToken: string;
    amountIn: bigint;
    slippageBps?: number;
};

export type SwapInParams<SwapData = any> = {
    inputToken: string;
    outputToken: string;
    amountIn: bigint;
    minAmountOut: bigint;
    isSimulation: boolean;
    data?: SwapData;
};

export interface TrustWalletProvider<
    QuoteData = any,
    TQuoteResult extends QuoteResult<QuoteData> = QuoteResult<QuoteData>,
    SwapResultData = any,
    TSwapResult extends
        SwapInResult<SwapResultData> = SwapInResult<SwapResultData>,
> {
    getCurrencyAddress(): string;
    getAddress(): string;
    getQuoteIn(props: QuoteInParams): Promise<TQuoteResult>;
    swapIn(props: SwapInParams<QuoteData>): Promise<TSwapResult>;

    executeSwap<SwapData = any, SwapResultData = any>(params: {
        inputToken: string;
        outputToken: string;
        swapData: SwapData;
    }): Promise<SwapInResult<SwapResultData>>;

    getTokenFromWallet(tokenSymbol: string): Promise<string | null>;
    getAccountBalance(): Promise<bigint>;
}

export type TokenMetadata = {
    chain: string;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    metadata: Record<string, any>;
};

export type TokenMarketData = {
    price: number;
    priceUsd: string;
    price24hChange: number;

    marketCap: number;

    uniqueWallet24h: number;
    uniqueWallet24hChange: number;

    volume24h: number;
    volume24hChange: number;

    trades: number;
    trades24hChange: number;

    liquidityUsd: number;

    holders: number;
};

// wip
export interface ITrustTokenProvider {
    // getTokenMetadata(
    //     chain: string,
    //     tokenAddress: string
    // ): Promise<TokenMetadata>;
    // getTokenMarketData(
    //     chain: string,
    //     tokenAddress: string
    // ): Promise<TokenMarketData>;

    getTokenOverview(
        chain: string,
        tokenAddress: string,
        forceRefresh?: boolean
    ): Promise<TokenMetadata & TokenMarketData>;

    shouldTradeToken(chain: string, tokenAddress: string): Promise<boolean>;

    //TODO: return metadata?
    resolveTicker(chain: string, ticker: string): Promise<string | null>;
}

export interface RecommendationMemory extends Memory {
    content: Content & {
        recommendation: MessageRecommendation & {
            confirmed?: boolean;
        };
    };
}

// TODO: Consolidate this into "Entity" with metadata
export type Account = {
    id: UUID;
    name: string;
    username: string;
    email: string;
    avatarUrl: string;
    telegramId: string;
    discordId: string;
};

export type TokenCodex = {
    id: string;
    address: string;
    cmcId: number;
    decimals: number;
    name: string;
    symbol: string;
    imageThumbUrl: string;
    blueCheckmark: boolean;
    totalSupply: string;
    circulatingSupply: string;
    info?: { circulatingSupply: string; imageThumbUrl: string };
    explorerData?: {
        blueCheckmark: boolean;
    };
    isScam: boolean;
};

export type TokenTradeData = {
    address: string;
    holder: number;
    market: number;
    last_trade_unix_time: number;
    last_trade_human_time: string;
    price: number;
    history_30m_price: number;
    price_change_30m_percent: number;
    history_1h_price: number;
    price_change_1h_percent: number;
    history_2h_price: number;
    price_change_2h_percent: number;
    history_4h_price: number;
    price_change_4h_percent: number;
    history_6h_price: number;
    price_change_6h_percent: number;
    history_8h_price: number;
    price_change_8h_percent: number;
    history_12h_price: number;
    price_change_12h_percent: number;
    history_24h_price: number;
    price_change_24h_percent: number;
    unique_wallet_30m: number;
    unique_wallet_history_30m: number;
    unique_wallet_30m_change_percent: number;
    unique_wallet_1h: number;
    unique_wallet_history_1h: number;
    unique_wallet_1h_change_percent: number;
    unique_wallet_2h: number;
    unique_wallet_history_2h: number;
    unique_wallet_2h_change_percent: number;
    unique_wallet_4h: number;
    unique_wallet_history_4h: number;
    unique_wallet_4h_change_percent: number;
    unique_wallet_8h: number;
    unique_wallet_history_8h: number | null;
    unique_wallet_8h_change_percent: number | null;
    unique_wallet_24h: number;
    unique_wallet_history_24h: number | null;
    unique_wallet_24h_change_percent: number | null;
    trade_30m: number;
    trade_history_30m: number;
    trade_30m_change_percent: number;
    sell_30m: number;
    sell_history_30m: number;
    sell_30m_change_percent: number;
    buy_30m: number;
    buy_history_30m: number;
    buy_30m_change_percent: number;
    volume_30m: number;
    volume_30m_usd: number;
    volume_history_30m: number;
    volume_history_30m_usd: number;
    volume_30m_change_percent: number;
    volume_buy_30m: number;
    volume_buy_30m_usd: number;
    volume_buy_history_30m: number;
    volume_buy_history_30m_usd: number;
    volume_buy_30m_change_percent: number;
    volume_sell_30m: number;
    volume_sell_30m_usd: number;
    volume_sell_history_30m: number;
    volume_sell_history_30m_usd: number;
    volume_sell_30m_change_percent: number;
    trade_1h: number;
    trade_history_1h: number;
    trade_1h_change_percent: number;
    sell_1h: number;
    sell_history_1h: number;
    sell_1h_change_percent: number;
    buy_1h: number;
    buy_history_1h: number;
    buy_1h_change_percent: number;
    volume_1h: number;
    volume_1h_usd: number;
    volume_history_1h: number;
    volume_history_1h_usd: number;
    volume_1h_change_percent: number;
    volume_buy_1h: number;
    volume_buy_1h_usd: number;
    volume_buy_history_1h: number;
    volume_buy_history_1h_usd: number;
    volume_buy_1h_change_percent: number;
    volume_sell_1h: number;
    volume_sell_1h_usd: number;
    volume_sell_history_1h: number;
    volume_sell_history_1h_usd: number;
    volume_sell_1h_change_percent: number;
    trade_2h: number;
    trade_history_2h: number;
    trade_2h_change_percent: number;
    sell_2h: number;
    sell_history_2h: number;
    sell_2h_change_percent: number;
    buy_2h: number;
    buy_history_2h: number;
    buy_2h_change_percent: number;
    volume_2h: number;
    volume_2h_usd: number;
    volume_history_2h: number;
    volume_history_2h_usd: number;
    volume_2h_change_percent: number;
    volume_buy_2h: number;
    volume_buy_2h_usd: number;
    volume_buy_history_2h: number;
    volume_buy_history_2h_usd: number;
    volume_buy_2h_change_percent: number;
    volume_sell_2h: number;
    volume_sell_2h_usd: number;
    volume_sell_history_2h: number;
    volume_sell_history_2h_usd: number;
    volume_sell_2h_change_percent: number;
    trade_4h: number;
    trade_history_4h: number;
    trade_4h_change_percent: number;
    sell_4h: number;
    sell_history_4h: number;
    sell_4h_change_percent: number;
    buy_4h: number;
    buy_history_4h: number;
    buy_4h_change_percent: number;
    volume_4h: number;
    volume_4h_usd: number;
    volume_history_4h: number;
    volume_history_4h_usd: number;
    volume_4h_change_percent: number;
    volume_buy_4h: number;
    volume_buy_4h_usd: number;
    volume_buy_history_4h: number;
    volume_buy_history_4h_usd: number;
    volume_buy_4h_change_percent: number;
    volume_sell_4h: number;
    volume_sell_4h_usd: number;
    volume_sell_history_4h: number;
    volume_sell_history_4h_usd: number;
    volume_sell_4h_change_percent: number;
    trade_8h: number;
    trade_history_8h: number | null;
    trade_8h_change_percent: number | null;
    sell_8h: number;
    sell_history_8h: number | null;
    sell_8h_change_percent: number | null;
    buy_8h: number;
    buy_history_8h: number | null;
    buy_8h_change_percent: number | null;
    volume_8h: number;
    volume_8h_usd: number;
    volume_history_8h: number;
    volume_history_8h_usd: number;
    volume_8h_change_percent: number | null;
    volume_buy_8h: number;
    volume_buy_8h_usd: number;
    volume_buy_history_8h: number;
    volume_buy_history_8h_usd: number;
    volume_buy_8h_change_percent: number | null;
    volume_sell_8h: number;
    volume_sell_8h_usd: number;
    volume_sell_history_8h: number;
    volume_sell_history_8h_usd: number;
    volume_sell_8h_change_percent: number | null;
    trade_24h: number;
    trade_history_24h: number;
    trade_24h_change_percent: number | null;
    sell_24h: number;
    sell_history_24h: number;
    sell_24h_change_percent: number | null;
    buy_24h: number;
    buy_history_24h: number;
    buy_24h_change_percent: number | null;
    volume_24h: number;
    volume_24h_usd: number;
    volume_history_24h: number;
    volume_history_24h_usd: number;
    volume_24h_change_percent: number | null;
    volume_buy_24h: number;
    volume_buy_24h_usd: number;
    volume_buy_history_24h: number;
    volume_buy_history_24h_usd: number;
    volume_buy_24h_change_percent: number | null;
    volume_sell_24h: number;
    volume_sell_24h_usd: number;
    volume_sell_history_24h: number;
    volume_sell_history_24h_usd: number;
    volume_sell_24h_change_percent: number | null;
};

export type HolderData = {
    address: string;
    balance: string;
};

export type TokenSecurityData = {
    ownerBalance: string;
    creatorBalance: string;
    ownerPercentage: number;
    creatorPercentage: number;
    top10HolderBalance: string;
    top10HolderPercent: number;
};

export type ProcessedTokenData = {
    token: TokenOverview;
    security: TokenSecurityData;
    tradeData: TokenTradeData;
    holderDistributionTrend: string; // 'increasing' | 'decreasing' | 'stable'
    highValueHolders: {
        holderAddress: string;
        balanceUsd: string;
    }[];
    recentTrades: boolean;
    highSupplyHoldersCount: number;
    dexScreenerData: DexScreenerData;

    isDexScreenerListed: boolean;
    isDexScreenerPaid: boolean;
    // tokenCodex: TokenCodex;
};

export type DexScreenerPair = {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number };
        h1: { buys: number; sells: number };
        h6: { buys: number; sells: number };
        h24: { buys: number; sells: number };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity?: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
    info: {
        imageUrl: string;
        websites: { label: string; url: string }[];
        socials: { type: string; url: string }[];
    };
    boosts: {
        active: number;
    };
};

export type DexScreenerData = {
    schemaVersion: string;
    pairs: DexScreenerPair[];
};

export type Prices = {
    solana: { usd: string };
    bitcoin: { usd: string };
    ethereum: { usd: string };
};

export type CalculatedBuyAmounts = {
    none: 0;
    low: number;
    medium: number;
    high: number;
};

export type WalletPortfolioItem = {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    balance: string;
    uiAmount: string;
    priceUsd: string;
    valueUsd: string;
    valueSol?: string;
};

export type WalletPortfolio = {
    totalUsd: string;
    totalSol?: string;
    items: WalletPortfolioItem[];
};

export type TokenOverview = {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
};