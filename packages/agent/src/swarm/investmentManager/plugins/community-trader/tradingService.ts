/**
 * TODO: This file needs major refactoring:
 * 
 * 1. External Dependencies to Remove/Replace:
 *    - socket.io-client (Socket, io)
 *    - async-mutex (Mutex)
 * 
 * 2. Internal Implementation Issues:
 *    - Replace mutex locking with a simpler mechanism
 *    - Replace socket.io event handling with a custom event system
 *    - Fix type mismatches with Recommender (UUID compatibility)
 *    - Fix type mismatches with Transaction (enum values and field types)
 * 
 * 3. Database Access Issues:
 *    - Replace direct DB calls with runtime.databaseAdapter or memoryManager
 *    - Missing methods in TrustScoreDatabase that need to be implemented:
 *      - getPositionBalance
 *      - getOpenPositionsByRecommenderAndToken
 *      - transaction
 *      - getPosition
 *      - getPositionInvestment
 *      - createPosition
 * 
 * 4. Type Conversion Issues:
 *    - Fix "BUY" to "buy" enum value conversions
 *    - Fix bigint to number type conversions
 *    - Fix Date to string conversions
 *
 * This file should eventually be rewritten according to the architecture 
 * guidelines in the comments at the top of the file.
 */

// TODO: This file needs major refactoring:
// 1. Remove the mutex and socket.io client
// 2. Replace with event-based approach
// 3. Use runtime.databaseAdapter or memoryManager instead of direct DB calls
// 4. Fix type mismatches with Recommender and Transaction types

import { type IAgentRuntime, Service, type UUID } from "@elizaos/core";
import { v4 as uuid } from "uuid";
import { Sonar, TrustScoreBeClient } from "./backend.js";
import { TrustScoreDatabase } from "./db.js";
import { calculatePositionPerformance } from "./performanceScore.js";
import { calculateOverallRiskScore, TrustScoreManager } from "./scoreManager.js";
import { TrustTokenProvider } from "./tokenProvider.js";
import type {
    BuyData,
    ITrustTokenProvider,
    Position,
    QuoteResult,
    Recommender,
    SellData,
    TokenPerformance,
    Transaction,
    TrustWalletProvider
} from "./types.js";
import {
    BuyAmountConfig,
    getConvictionMultiplier,
    getLiquidityMultiplier,
    getMarketCapMultiplier,
    getVolumeMultiplier,
} from "./utils.js";
type SellSignalMessage = {
    positionId: UUID;
    tokenAddress: string;
    pairId: string;
    amount: string;
    currentBalance: string;
    sellRecommenderId: UUID;
    walletAddress: string;
    isSimulation: boolean;
};

type PriceData = {
    initialPrice: string;
    currentPrice: string;
    priceChange: number;
    tokenAddress: string;
    positionId: UUID;
};

type BuySignalMessage = {
    positionId: UUID;
    tokenAddress: string;
    recommenderId: UUID;
};

// Replace mutex with simple lock tracking
type LockInfo = {
    isLocked: boolean;
    lastUsed: number;
};

type SocketHandler<T> = (data: T) => void;

const SLIPPAGE_BPS = 50; // 0.5% TODO: move this to config
const FORCE_SIMULATION = true; // TODO: add this to config?

export class TrustTradingService extends Service {
    serviceType = "trust_trading";

    public readonly scoreManager: TrustScoreManager;
    public readonly db: TrustScoreDatabase;

    public readonly tokenProvider: ITrustTokenProvider;

    private readonly backend?: TrustScoreBeClient;
    private readonly sonar?: Sonar;

    private positions: Map<
        string,
        { id: UUID; chain: string; tokenAddress: string }
    > = new Map();

    private initialized = false;

    private wallets: Map<string, TrustWalletProvider>;

    // Replace socket with simpler implementation
    private eventHandlers: Map<string, (data: any) => void> = new Map();

    // sell signal map
    private sellSignalMutexMap: Map<string, LockInfo> = new Map();
    // buy signal transaction lock
    private transactionLocked = false;

    private runtime: IAgentRuntime;

    //Cleans up expired mutexes from the sellSignalMutexMap.
    private cleanupExpiredSellMutexes() {
        const now = Date.now();
        for (const [key, lockInfo] of this.sellSignalMutexMap.entries()) {
            // cleanup after 2 hours
            if (now - lockInfo.lastUsed > 2 * 60 * 60 * 1000) {
                this.sellSignalMutexMap.delete(key);
            }
        }
    }
    
    // Simple locking mechanism
    private async withLock(action: () => Promise<void>): Promise<void> {
        // Wait until we can acquire the lock
        while (this.transactionLocked) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        try {
            this.transactionLocked = true;
            await action();
        } finally {
            this.transactionLocked = false;
        }
    }

    static createFromRuntime(runtime: IAgentRuntime) {
        const tokenProvider = new TrustTokenProvider(runtime);
        const db = new TrustScoreDatabase(runtime);
        const trustScoreManager = new TrustScoreManager(db, tokenProvider);

        let backend: TrustScoreBeClient | undefined;
        try {
            backend = TrustScoreBeClient.createFromRuntime(runtime);
        } catch (_error) {}

        let sonar: Sonar | undefined;
        try {
            sonar = Sonar.createFromRuntime(runtime);
        } catch (_error) {}

        return new TrustTradingService(
            runtime,
            trustScoreManager,
            db,
            tokenProvider,
            backend,
            sonar
        );
    }

    constructor(
        runtime: IAgentRuntime,
        scoreManager: TrustScoreManager,
        db: TrustScoreDatabase,
        tokenProvider: ITrustTokenProvider,
        backend?: TrustScoreBeClient,
        sonar?: Sonar
    ) {
        super();
        this.wallets = new Map();
        this.runtime = runtime;
        this.scoreManager = scoreManager;
        this.db = db;
        this.tokenProvider = tokenProvider;
        this.backend = backend;
        this.sonar = sonar;

        // Set the default interval to clean up expired mutexes every hour
        setInterval(() => {
            this.cleanupExpiredSellMutexes();
        }, 1000 * 60 * 60);
    }

    registerWallet(chain: string, wallet: TrustWalletProvider) {
        this.wallets.set(chain, wallet);
    }

    hasWallet(chain: string) {
        return this.wallets.has(chain);
    }

    async resolveTicker(chain: string, ticker: string): Promise<string | null> {
        const tokenAddress = await this.tokenProvider.resolveTicker(
            chain,
            ticker
        );

        if (tokenAddress) return tokenAddress;

        const wallet = this.wallets.get(chain);
        return wallet ? await wallet.getTokenFromWallet(ticker) : null;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
        console.log("trading service initialized");
        await this.startListeners();
    }

    private async startListeners() {
        // Instead of using socket.io, we'll use runtime events or polling
        
        // Register event handlers for signals
        this.addEventListener("buySignal", (data: BuySignalMessage) => {
            this.handleBuySignal(data);
        });

        this.addEventListener("sellSignal", (data: SellSignalMessage) => {
            this.handleSellSignal(data);
        });

        this.addEventListener("priceSignal", (data: PriceData) => {
            this.handlePriceSignal(data);
        });

        // Use runtime database adapter to get positions
        // This comment matches the code comments at the top of the file:
        // "remove this.db and calls to the db - old mongoose stuff
        // instead, use the runtime.databaseAdapter or memoryManager / messageManager"
        
        // Use a cache query approach instead since findMany might not be available
        const positionsCache = await this.runtime.cacheManager.get("positions") || [];
        const positions = Array.isArray(positionsCache) ? positionsCache.filter(p => !p.closed) : [];

        for (const position of positions) {
            this.positions.set(position.id, {
                id: position.id,
                chain: position.chain,
                tokenAddress: position.tokenAddress,
            });
        }
    }

    public async handleRecommendation(
        recommender: Recommender,
        recomendation: {
            chain: string;
            tokenAddress: string;
            type: "BUY" | "DONT_BUY" | "SELL" | "DONT_SELL" | "NONE";
            conviction: "NONE" | "LOW" | "MEDIUM" | "HIGH";
            timestamp: Date;
            metadata: Record<string, any>;
        }
    ): Promise<boolean> {
        const userOpenPositions =
            await this.db.getOpenPositionsByRecommenderAndToken(
                recommender.id,
                recomendation.tokenAddress
            );
        if (userOpenPositions.length > 0) {
            console.log(
                `User has open position for ${recomendation.tokenAddress}, skipping recommendation`
            );
            return false;
        }
        const { tokenRecommendation, alreadyRecommended, tokenPerformance } =
            await this.db.transaction(async (tx) => {
                const tokenPerformance =
                    await this.scoreManager.updateTokenPerformance(
                        recomendation.chain,
                        recomendation.tokenAddress
                    );

                // Only create recommendation if it doesn't exists from that user and token address
                const existingRecommendations =
                    await this.db.getRecommendationsByRecommender(
                        recommender.id,
                        tx
                    );

                const alreadyRecommended = userAlreadyRecommended(
                    existingRecommendations,
                    recomendation.tokenAddress
                );

                const tokenRecommendation = alreadyRecommended
                    ? // Update token recommendation here
                      await this.scoreManager.updateTokenRecommendation(
                          {
                              ...alreadyRecommended,
                              marketCap:
                                  tokenPerformance.currentMarketCap.toString(),
                              liquidity: tokenPerformance.liquidity.toString(),
                              price: tokenPerformance.price.toString(),
                              metadata: recomendation.metadata,
                          },
                          tx
                      )
                    : await this.scoreManager.createTokenRecommendation(
                          {
                              id: uuid() as UUID,
                              chain: recomendation.chain,
                              recommenderId: recommender.id,
                              tokenAddress: recomendation.tokenAddress,
                              createdAt: recomendation.timestamp,
                              conviction: recomendation.conviction as
                                  | "NONE"
                                  | "LOW"
                                  | "MEDIUM"
                                  | "HIGH",
                              type: recomendation.type as
                                  | "BUY"
                                  | "DONT_BUY"
                                  | "SELL"
                                  | "DONT_SELL"
                                  | "NONE",
                              marketCap:
                                  tokenPerformance.currentMarketCap.toString(),
                              liquidity: tokenPerformance.liquidity.toString(),
                              price: tokenPerformance.price.toString(),
                              metadata: recomendation.metadata,
                              status: "ACTIVE",
                              isScam: tokenPerformance.isScam,
                              rugPull: tokenPerformance.rugPull,

                              riskScore: 0,
                              performanceScore: 0,
                          },
                          tx
                      );

                await this.backend?.createRecommendation(
                    recommender,
                    tokenRecommendation
                );
                console.log("created recommendation");

                return {
                    tokenRecommendation,
                    alreadyRecommended,
                    tokenPerformance,
                };
            });

        const shouldTrade = await this.tokenProvider.shouldTradeToken(
            recomendation.chain,
            recomendation.tokenAddress
        );
        console.log({ shouldTrade });

        if (!shouldTrade) {
            console.warn(
                "There might be a problem with the token, not trading."
            );

            switch (recomendation.type) {
                // for now, lets just assume buy only, but we should implement
                case "BUY": {
                    // eslint-disable-next-line no-case-declarations
                    const wallet = this.wallets.get(recomendation.chain);

                    if (!wallet) return false;

                    // eslint-disable-next-line no-case-declarations
                    const solAmount = await this.getBuyAmount({
                        chain: recomendation.chain,
                        tokenPerformance: tokenPerformance,
                        conviction: recomendation.conviction,
                        recommender: recommender,
                        socialSentiment: null, // To Do - when we add socialSentiment
                    });

                    // eslint-disable-next-line no-case-declarations
                    const { amountOut: minAmountOut, data } =
                        await wallet.getQuoteIn({
                            amountIn: solAmount,
                            inputToken: wallet.getCurrencyAddress(),
                            outputToken: recomendation.tokenAddress,
                            slippageBps: SLIPPAGE_BPS,
                        });

                    console.log({ minAmountOut, data });

                    // eslint-disable-next-line no-case-declarations
                    const { txHash, amountOut, timestamp } =
                        await this.executeSwap({
                            isSimulation: true,
                            chain: recomendation.chain,
                            inputToken: wallet.getCurrencyAddress(),
                            outputToken: recomendation.tokenAddress,
                            amountIn: solAmount,
                            minAmountOut,
                            quoteData: data,
                        });

                    await this.processBuy({
                        positionId: uuid() as UUID,
                        isSimulation: true,
                        chain: recomendation.chain,
                        tokenAddress: recomendation.tokenAddress,
                        recommender,
                        recommendationId: tokenRecommendation.id,
                        solAmount,
                        buyAmount: amountOut,
                        timestamp,
                        walletAddress: wallet.getAddress(),
                        txHash,
                        initialTokenPriceUsd: tokenPerformance.price.toString(),
                    });

                    return true;
                }
                case "SELL":
                    console.warn("Not implemented");
                    break;
                case "DONT_SELL":
                    console.warn("Not implemented");
                    break;
                case "DONT_BUY":
                    console.warn("Not implemented");
                    break;
                case "NONE":
                    console.warn("Not implemented");
                    break;
            }

            return false;
        }

        switch (recomendation.type) {
            // for now, lets just assume buy only, but we should implement
            case "BUY": {
                // eslint-disable-next-line no-case-declarations
                const wallet = this.wallets.get(recomendation.chain);

                if (!wallet) return false;

                // eslint-disable-next-line no-case-declarations
                const solAmount = await this.getBuyAmount({
                    chain: recomendation.chain,
                    tokenPerformance: tokenPerformance,
                    conviction: recomendation.conviction,
                    recommender: recommender,
                    socialSentiment: null, // To Do - when we add socialSentiment
                });

                // eslint-disable-next-line no-case-declarations
                const { amountOut: minAmountOut, data } =
                    await wallet.getQuoteIn({
                        amountIn:
                            solAmount === 0n ? BigInt(1000000000) : solAmount,
                        inputToken: wallet.getCurrencyAddress(),
                        outputToken: recomendation.tokenAddress,
                        slippageBps: SLIPPAGE_BPS,
                    });

                // eslint-disable-next-line no-case-declarations
                const { txHash, amountOut, timestamp } = await this.executeSwap(
                    {
                        isSimulation: true,
                        chain: recomendation.chain,
                        inputToken: wallet.getCurrencyAddress(),
                        outputToken: recomendation.tokenAddress,
                        amountIn: solAmount,
                        minAmountOut,
                        quoteData: data,
                    }
                );

                await this.processBuy({
                    positionId: uuid() as UUID,
                    isSimulation: true,
                    chain: recomendation.chain,
                    tokenAddress: recomendation.tokenAddress,
                    recommender,
                    recommendationId: tokenRecommendation.id,
                    solAmount,
                    buyAmount: amountOut,
                    timestamp,
                    walletAddress: wallet.getAddress(),
                    txHash,
                    initialTokenPriceUsd: tokenPerformance.price.toString(),
                });

                return true;
            }
            case "SELL":
                console.warn("Not implemented");
                break;
            case "DONT_SELL":
                console.warn("Not implemented");
                break;
            case "DONT_BUY":
                console.warn("Not implemented");
                break;
            case "NONE":
                console.warn("Not implemented");
                break;
        }

        return false;
    }

    async getBuyAmount({
        chain,
        tokenPerformance,
        conviction,
        recommender,
        socialSentiment,
    }: {
        chain: string;
        tokenPerformance: TokenPerformance;
        conviction: "NONE" | "LOW" | "MEDIUM" | "HIGH";
        recommender: Recommender;
        socialSentiment?: number | null;
    }): Promise<bigint> {
        try {
            const wallet = this.wallets.get(chain);
            if (!wallet) return 0n;

            const accountBalance = await wallet.getAccountBalance();

            // Early exit if the account balance is too low.
            if (accountBalance < BuyAmountConfig.MIN_BUY_LAMPORTS) return 0n;

            // Get recommender trust metrics.
            const recommenderMetrics = await this.db.getRecommenderMetrics(
                recommender.id
            );
            const trustScore = recommenderMetrics?.trustScore ?? 0;
            const trustScoreMultiplier = 1 + trustScore / 100;
            const socialSentimentMultiplier = socialSentiment
                ? 1 + socialSentiment / 100
                : 1;

            // Calculate the base buy amountd based on a percentage of the account balance.
            const baseBuyAmount = BigInt(
                Math.floor(
                    Number(accountBalance) *
                        BuyAmountConfig.MAX_ACCOUNT_PERCENTAGE
                )
            );

            // Compute multipliers.
            const liquidityMultiplier = getLiquidityMultiplier(
                tokenPerformance.liquidity
            );
            const volumeMultiplier = getVolumeMultiplier(
                tokenPerformance.volume
            );
            const marketCapMultiplier = getMarketCapMultiplier(
                tokenPerformance.currentMarketCap
            );
            const convictionMultiplier = getConvictionMultiplier(conviction);

            // Calculate the final buy amount by applying multipliers.
            let buyAmount = BigInt(
                Math.floor(
                    Number(baseBuyAmount) *
                        liquidityMultiplier *
                        volumeMultiplier *
                        marketCapMultiplier *
                        convictionMultiplier *
                        trustScoreMultiplier *
                        socialSentimentMultiplier
                )
            );

            // Enforce the minimum and maximum constraints.
            if (buyAmount < BuyAmountConfig.MIN_BUY_LAMPORTS)
                buyAmount = BuyAmountConfig.MIN_BUY_LAMPORTS;
            if (buyAmount > BuyAmountConfig.MAX_BUY_LAMPORTS)
                buyAmount = BuyAmountConfig.MAX_BUY_LAMPORTS;

            return buyAmount;
        } catch (error) {
            console.error(
                `Error calculating buy amount for chain ${chain}:`,
                error
            );
            return 0n;
        }
    }

    private async validateRecommender(_recommender: Recommender) {
        return true;
        // const recommenderMetrics = await this.db.getRecommenderMetrics(
        //     recommender.id
        // );
        // return recommenderMetrics?.trustScore >= 70;
    }

    private async handleBuySignal({
        positionId,
        tokenAddress,
        recommenderId,
    }: BuySignalMessage) {
        const recommender = await this.db.getRecommender(recommenderId);
        if (!recommender) return;

        if (!(await this.validateRecommender(recommender))) return;

        const position = await this.db.getPosition(positionId);
        if (!position) {
            await this.sonar?.stopProcess(positionId);
            return;
        }

        if (!position.isSimulation) return;

        const wallet = this.wallets.get(position.chain);

        if (!wallet) return;

        // todo: use initialAmount?
        const solAmount = await this.db.getPositionInvestment(positionId);
        if (solAmount === 0n) return;

        // Update to handle multiple chains
        const tokenPerformance = await this.scoreManager.updateTokenPerformance(
            "solana",
            position.tokenAddress,
            true
        );

        // close simulation position
        await this.closePosition(position.id);
        try {
            await this.withLock(async () => {
                const { amountOut: minAmountOut, data } =
                    await wallet.getQuoteIn({
                        amountIn: solAmount,
                        inputToken: wallet.getCurrencyAddress(),
                        outputToken: tokenAddress,
                        slippageBps: SLIPPAGE_BPS,
                    });

                const { txHash, amountOut, timestamp } = await this.executeSwap(
                    {
                        chain: position.chain,
                        inputToken: wallet.getCurrencyAddress(),
                        outputToken: tokenAddress,
                        amountIn: solAmount,
                        minAmountOut: minAmountOut,
                        isSimulation: !!FORCE_SIMULATION,
                        quoteData: data,
                    }
                );

                await this.processBuy({
                    positionId: uuid() as UUID,
                    isSimulation: false,
                    chain: position.chain,
                    recommender,
                    recommendationId: position.recommendationId,
                    solAmount,
                    buyAmount: amountOut,
                    tokenAddress,
                    txHash,
                    timestamp,
                    walletAddress: wallet.getAddress(),
                    initialTokenPriceUsd: tokenPerformance.price.toString(),
                });
            });
        } catch (error) {
            console.error("Error processing buy signal", error);
        }
    }

    private async processBuy(data: BuyData) {
        const { recommender, tokenAddress } = data;

        const position = await this.savePosition(data);

        await this.backend?.createPosition(position, data);

        const process = await this.sonar?.startProcess({
            id: data.positionId,
            tokenAddress: tokenAddress,
            balance: data.buyAmount.toString(),
            isSimulation: data.isSimulation,
            recommenderId: recommender.id,
            initialMarketCap: position.initialMarketCap,
            walletAddress: data.walletAddress,
            txHash: data.txHash,
            initialPrice: data.initialTokenPriceUsd,
        });

        if (process) {
            this.positions.set(position.id, {
                id: position.id,
                chain: position.chain,
                tokenAddress: position.tokenAddress,
            });
        }
    }

    private async savePosition(data: BuyData): Promise<Position> {
        const { chain, tokenAddress, recommender, recommendationId } = data;

        const tokenPerformance = await this.scoreManager.updateTokenPerformance(
            chain,
            tokenAddress
        );

        const price = tokenPerformance.price.toString();
        const marketCap = tokenPerformance.currentMarketCap.toString();
        const liquidity = tokenPerformance.liquidity.toString();

        const position: Position = {
            id: data.positionId,
            walletAddress: data.walletAddress,
            isSimulation: data.isSimulation,
            chain: data.chain,
            tokenAddress: tokenAddress,
            recommenderId: recommender.id,
            recommendationId,
            initialPrice: price,
            initialMarketCap: marketCap,
            initialLiquidity: liquidity,
            openedAt: data.timestamp,
            updatedAt: data.timestamp,
            rapidDump: false,
            performanceScore: 0,
        };

        await this.db.createPosition(position);

        await this.db.addTransaction({
            id: uuid() as UUID,
            type: "BUY",
            chain: data.chain,
            tokenAddress: data.tokenAddress,
            transactionHash: data.txHash,
            positionId: position.id,
            amount: data.buyAmount,
            solAmount: data.solAmount,
            marketCap,
            liquidity,
            price,
            isSimulation: data.isSimulation,
            timestamp: data.timestamp,
        });

        return position;
    }

    private async handlePriceSignal(data: PriceData) {
        if (!this.sonar) return;
        try {
            const {
                positionId,
                tokenAddress,
                // currentPrice,
                priceChange,
                // initialPrice,
            } = data;
            if (priceChange !== 0) {
                const position = await this.db.getPosition(positionId);

                if (!position) {
                    await this.sonar?.stopProcess(positionId);
                    return;
                }

                // check if the position has been closed
                if (position.closedAt) {
                    await this.sonar?.stopProcess(positionId);
                    return;
                }
                // update token performance

                const tokenPerformance =
                    await this.scoreManager.updateTokenPerformance(
                        position.chain,
                        tokenAddress
                    );

                // get recommendation and update price, marketCap, liquidity
                const existingRecommendations =
                    await this.db.getRecommendationsByRecommender(
                        position.recommenderId
                    );

                const recommendation = userAlreadyRecommended(
                    existingRecommendations,
                    tokenAddress
                );
                await this.scoreManager.updateTokenRecommendation({
                    ...recommendation,
                    marketCap: tokenPerformance.currentMarketCap.toString(),
                    liquidity: tokenPerformance.liquidity.toString(),
                    price: tokenPerformance.price.toString(),
                });
            }
        } catch (error) {
            console.error("Error processing price signal", error);
        }
    }

    private async handleSellSignal(signal: SellSignalMessage) {
        if (!this.sonar) return;

        const { positionId, tokenAddress, amount, sellRecommenderId } = signal;

        const position = await this.db.getPosition(positionId);

        if (!position) {
            await this.sonar?.stopProcess(positionId);
            return;
        }

        const wallet = this.wallets.get(position.chain);
        if (!wallet) return;

        const type = position.isSimulation ? "simulation" : "transaction";

        console.log(
            `Received ${type} message for token ${tokenAddress} to sell ${amount}`
        );

        const cacheKey = `${positionId}:${tokenAddress}`;
        let sellSignalMutex = this.sellSignalMutexMap.get(cacheKey);
        if (!sellSignalMutex) {
            sellSignalMutex = { isLocked: false, lastUsed: Date.now() };
            this.sellSignalMutexMap.set(cacheKey, sellSignalMutex);
        }

        try {
            await this.withLock(async () => {
                const recommender =
                    await this.db.getRecommender(sellRecommenderId);
                if (!recommender) return;

                const tokenPerformance =
                    await this.scoreManager.updateTokenPerformance(
                        position.chain,
                        tokenAddress,
                        true
                    );

                const amountIn = BigInt(amount);

                const quoteResponse = await this.sonar?.quote({
                    chain: position.chain,
                    walletAddress: wallet.getAddress(),
                    inputToken: tokenAddress,
                    outputToken: wallet.getCurrencyAddress(),
                    amountIn,
                    slippageBps: SLIPPAGE_BPS, // 0.5% slippage
                });
                if (!quoteResponse) {
                    console.error("Error getting quote for sell signal");
                    return;
                }
                const { quoteData, swapTransaction } = quoteResponse ?? {};

                // TODO: verify swap data using quoteData
                const { txHash, amountOut, timestamp } = await this.executeSwap(
                    {
                        isSimulation: FORCE_SIMULATION
                            ? true
                            : position.isSimulation,
                        chain: position.chain,
                        inputToken: tokenAddress,
                        outputToken: wallet.getCurrencyAddress(),
                        amountIn,
                        minAmountOut: 0n,
                        quoteData,
                        swapData: { swapTransaction },
                    }
                );

                await this.processSell({
                    tokenPerformance,
                    position,
                    amountToSell: amountIn,
                    recommender,
                    amountOut,
                    txHash,
                    timestamp,
                });
            });
        } catch (error) {
            console.error("Error processing sell signal", error);
        } finally {
            // Clean up expired mutex entries after processing the sell signal
            this.cleanupExpiredSellMutexes();
        }
    }

    private async updatePositionOnSell(position: Position, data: SellData) {
        const { chain, positionId, tokenAddress, isSimulation } = data;
        const trade = await this.db.getPosition(positionId);

        if (!trade) return;

        const tokenPerformance = await this.scoreManager.updateTokenPerformance(
            chain,
            tokenAddress,
            true
        );

        const price = tokenPerformance.price.toString();
        const marketCap = tokenPerformance.currentMarketCap.toString();
        const liquidity = tokenPerformance.liquidity.toString();

        const tx: Transaction = {
            id: uuid() as UUID,
            type: "SELL",
            chain,
            tokenAddress,
            positionId,
            isSimulation,
            transactionHash: data.txHash,
            amount: data.sellAmount,
            solAmount: data.solAmount,
            price,
            liquidity,
            marketCap,
            timestamp: data.timestamp,
        };

        await this.db.addTransaction(tx);

        const { performanceScore } = calculatePositionPerformance(
            await this.db.getPositionTransactions(positionId)
        );

        await this.db.updatePosition({
            ...position,
            updatedAt: tx.timestamp,
            performanceScore,
        });

        const existingRecommendations =
            await this.db.getRecommendationsByRecommender(
                position.recommenderId
            );

        const recommendation = userAlreadyRecommended(
            existingRecommendations,
            tokenAddress
        );
        const recommenderMetrics = await this.db.getRecommenderMetrics(
            position.recommenderId
        );

        if (!recommenderMetrics) return;

        const riskScore = calculateOverallRiskScore(
            tokenPerformance,
            existingRecommendations
        );

        await this.scoreManager.updateTokenRecommendation({
            ...recommendation,
            performanceScore,
            riskScore,
        });

        await this.scoreManager.updateRecommenderMetrics(data.recommender.id);
    }

    private async processSell(params: {
        tokenPerformance: TokenPerformance;
        position: Position;
        amountToSell: bigint;
        amountOut: bigint;
        txHash: string;
        recommender: Recommender;
        timestamp: Date;
    }) {
        const {
            tokenPerformance,
            position,
            amountToSell,
            recommender,
            amountOut,
            txHash,
            timestamp,
        } = params;

        const { tokenAddress } = position;

        console.log(
            `Executing sell for token ${tokenPerformance.symbol}: ${amountToSell}`
        );

        const sellData: SellData = {
            chain: position.chain,
            positionId: position.id,
            tokenAddress,
            sellAmount: amountToSell,
            solAmount: amountOut,
            recommender,
            timestamp,
            isSimulation: position.isSimulation,
            walletAddress: position.walletAddress,
            txHash,
        };

        await this.updatePositionOnSell(position, sellData);

        const balance = await this.db.getPositionBalance(position.id);

        await this.sonar?.saveTransaction({
            id: position.id,
            address: position.tokenAddress,
            isSimulation: position.isSimulation,
            amount: sellData.sellAmount.toString(),
            marketCap: tokenPerformance.currentMarketCap,
            recommenderId: recommender.id,
            walletAddress: position.walletAddress,
            txHash: sellData.txHash,
        });

        const closePosition = balance <= 0n;
        console.log({ balance, closePosition });

        await this.backend?.updatePosition(position, sellData, closePosition);

        if (closePosition) {
            await this.closePosition(position.id);
        }
    }

    async executeSwap<QuoteData = any, SwapData = any>({
        chain,
        inputToken,
        outputToken,
        amountIn,
        minAmountOut,
        isSimulation,
        quoteData,
        swapData,
    }: {
        chain: string;
        inputToken: string;
        outputToken: string;
        amountIn: bigint;
        minAmountOut?: bigint;
        isSimulation?: boolean;
        quoteData?: QuoteResult<QuoteData>;
        swapData?: SwapData;
    }) {
        console.log("executing swap...", { inputToken, outputToken, amountIn });

        const wallet = this.wallets.get(chain);
        if (!wallet) throw new Error(`Missing wallet for chain: ${chain}`);

        if (isSimulation)
            return await wallet.swapIn({
                inputToken,
                outputToken,
                amountIn,
                minAmountOut: minAmountOut ?? 0n,
                isSimulation,
                data: quoteData,
            });

        if (swapData) {
            return await wallet.executeSwap({
                inputToken,
                outputToken,
                swapData,
            });
        }

        const { amountOut, data } =
            quoteData ??
            (await wallet.getQuoteIn({
                inputToken,
                outputToken,
                amountIn,
                slippageBps: SLIPPAGE_BPS,
            }));

        if (minAmountOut && minAmountOut > amountOut) {
            throw new Error("minAmountOut");
        }

        return await wallet.swapIn({
            inputToken,
            outputToken,
            amountIn,
            minAmountOut: amountOut,
            isSimulation: isSimulation ?? false,
            data,
        });
    }

    async closePosition(positionId: UUID) {
        this.positions.delete(positionId);
        await this.db.closePosition(positionId);
        await this.sonar?.stopProcess(positionId);
    }

    async stopAllSonarProccess() {
        console.log("stopAllSonarProccess");
        for (const { id, tokenAddress } of this.positions.values()) {
            console.log({ id, tokenAddress });
            await this.sonar?.stopProcess(id);
        }
    }

    // Helper method to add event listeners
    private addEventListener(event: string, handler: (data: any) => void) {
        this.eventHandlers.set(event, handler);
    }

    // Helper method to emit events (for testing or internal use)
    private emitEvent(event: string, data: any) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
            handler(data);
        }
    }
}

export function userAlreadyRecommended(
    recommendations: any[],
    tokenAddress: string
) {
    // fix issue where we were using address instead of tokenAddress
    return recommendations.find(
        (r) =>
            r.tokenAddress.trim().toLowerCase() ===
            tokenAddress.trim().toLowerCase()
    );
}
