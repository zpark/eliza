import {
    RecommenderMetrics,
    TokenPerformance,
    Recommender,
    ITrustTokenProvider,
    TokenMarketData,
    TokenSecurityData,
    Optional,
    TokenRecommendation,
} from "./types";
import { TrustScoreDatabase } from "./db";
import { UUID } from "@elizaos/core";

const DECAY_RATE = 0.95;
const MAX_DECAY_DAYS = 30;

export class TrustScoreManager {
    private readonly db: TrustScoreDatabase;

    public readonly tokenProvider: ITrustTokenProvider;

    constructor(db: TrustScoreDatabase, tokenProvider: ITrustTokenProvider) {
        this.db = db;
        this.tokenProvider = tokenProvider;
    }

    async getOrCreateRecommender(
        recommender: Optional<Recommender, "id">
    ): Promise<Recommender> {
        return await this.db.getOrCreateRecommender(recommender);
    }

    async getRecommenderMetrics(
        recommenderId: UUID
    ): Promise<RecommenderMetrics> {
        const recommenderMetrics =
            await this.db.getRecommenderMetrics(recommenderId);

        if (!recommenderMetrics) {
            await this.db.initializeRecommenderMetrics(recommenderId);
            return this.getRecommenderMetrics(recommenderId);
        }

        return recommenderMetrics;
    }

    async createTokenRecommendation(
        recommendation: Omit<
            TokenRecommendation,
            | "initialMarketCap"
            | "initialPrice"
            | "initialLiquidity"
            | "updatedAt"
        >,
        tx?: any
    ): Promise<TokenRecommendation> {
        const data: TokenRecommendation = {
            ...recommendation,
            updatedAt: recommendation.createdAt,
            initialPrice: recommendation.price,
            initialLiquidity: recommendation.liquidity,
            initialMarketCap: recommendation.marketCap,
        };

        await this.db.addTokenRecommendation(data, tx);
        await this.updateRecommenderMetrics(recommendation.recommenderId);
        return data;
    }

    async updateTokenRecommendation(
        recommendation: Omit<
            TokenRecommendation,
            | "initialMarketCap"
            | "initialPrice"
            | "initialLiquidity"
            | "updatedAt"
        >,
        tx?: any
    ): Promise<TokenRecommendation> {
        const data: TokenRecommendation = {
            ...recommendation,
            updatedAt: new Date(),
            initialPrice: recommendation.price,
            initialLiquidity: recommendation.liquidity,
            initialMarketCap: recommendation.marketCap,
        };

        console.log("updateTokenRecommendation", data);

        await Promise.all([
            this.db.updateTokenRecommendation(data, tx),
            this.updateRecommenderMetrics(recommendation.recommenderId),
        ]);
        return data;
    }

    async updateRecommenderMetrics(recommenderId: UUID): Promise<void> {
        const {
            totalRecommendations,
            lastActiveDate,
            avgTokenPerformance,
            successfulRecs,
            trustScore,
            riskScore,
        } = await this.db.calculateRecommenderMetrics(recommenderId);

        console.log({
            totalRecommendations,
            lastActiveDate,
            avgTokenPerformance,
            successfulRecs,
            trustScore,
            riskScore,
        });

        const now = new Date();

        const inactiveDays = Math.floor(
            (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const decayFactor = Math.pow(
            DECAY_RATE,
            Math.min(inactiveDays, MAX_DECAY_DAYS)
        );

        const trustDecay = trustScore * decayFactor;

        const consistencyScore =
            totalRecommendations > 0
                ? successfulRecs / totalRecommendations
                : 0;

        await this.db.updateRecommenderMetrics({
            recommenderId,
            trustScore,
            successfulRecs,
            lastActiveDate,
            avgTokenPerformance,
            trustDecay,
            totalRecommendations,
            riskScore,
            consistencyScore,
            virtualConfidence: 0,
            updatedAt: now,
        });
    }

    private async handleTokenPerformanceUpdate(
        previous: TokenPerformance,
        performance: TokenPerformance
    ) {
        const updates = {
            rapidDump: !previous?.rapidDump && performance.rapidDump,
            isScam: !previous?.isScam && performance.isScam,
            rugPull: !previous?.rugPull && performance.rugPull,
        };

        // todo: handle updates on scamm, rugpull,
        // if changes
        // update calculateRiskScore, other scores?
        // update all recommendations
        // update recommenders

        // if (Object.values(updates).filter(Boolean).length > 0) {
        // }
    }

    async updateTokenPerformance(
        chain: string,
        tokenAddress: string,
        forceRefresh: boolean = false
    ): Promise<TokenPerformance> {
        const [previousPerformance, data, validationTrust] = await Promise.all([
            this.db.getTokenPerformance(chain, tokenAddress),
            this.tokenProvider.getTokenOverview(
                chain,
                tokenAddress,
                forceRefresh
            ),
            this.db.calculateValidationTrust(chain, tokenAddress),
        ]);

        const rapidDump = isRapidDump(data);
        const sustainedGrowth = isSustainedGrowth(data);
        const suspiciousVolume = isSuspiciousVolume(data);

        await this.db.upsertTokenPerformance({
            chain,
            address: data.address,

            name: data.name,
            symbol: data.symbol,
            decimals: data.decimals,

            metadata: data.metadata,

            price: data.price,
            price24hChange: data.price24hChange,

            volume: data.volume24h,
            volume24hChange: data.volume24hChange,

            trades: data.trades,
            trades24hChange: data.trades24hChange,

            holders: data.holders,
            holders24hChange: data.uniqueWallet24hChange,

            liquidity: data.liquidityUsd,
            currentMarketCap: data.marketCap,

            rugPull: false,
            isScam: false, // TODO: implement scam detection, codex?

            sustainedGrowth,
            rapidDump,
            suspiciousVolume,
            validationTrust,

            updatedAt: new Date(),
        });

        const tokenPerformance = await this.db.getTokenPerformance(
            chain,
            tokenAddress
        )!;

        if (previousPerformance && tokenPerformance) {
            await this.handleTokenPerformanceUpdate(
                previousPerformance,
                tokenPerformance
            );
        }

        return tokenPerformance!;
    }
}

function calculateTrustScore(
    tokenPerformance: TokenPerformance,
    recommenderMetrics: RecommenderMetrics
): number {
    const riskScore = calculateRiskScore(tokenPerformance);

    const consistencyScore = calculateConsistencyScore(
        tokenPerformance,
        recommenderMetrics
    );

    return (riskScore + consistencyScore) / 2;
}

export function calculateOverallRiskScore(
    tokenPerformance: TokenPerformance,
    tokenRecommendation: TokenRecommendation[]
) {
    const riskScore = calculateRiskScore(tokenPerformance);

    const totalRiskCount = tokenRecommendation.length;

    const reducedRiskScore = tokenRecommendation.reduce(
        (acc, rec) => acc + rec.riskScore,
        riskScore
    );

    // This should be avg risk score
    return reducedRiskScore / totalRiskCount;
}

export function calculateRiskScore({
    rugPull,
    isScam,
    rapidDump,
    suspiciousVolume,
}: TokenPerformance): number {
    let riskScore = 0;
    if (rugPull) riskScore += 30;
    if (isScam) riskScore += 30;
    if (rapidDump) riskScore += 15;
    if (suspiciousVolume) riskScore += 15;
    return riskScore;
}

export function calculateConsistencyScore(
    tokenPerformance: TokenPerformance,
    recommenderMetrics: RecommenderMetrics
): number {
    const avgTokenPerformance = recommenderMetrics.avgTokenPerformance;
    const currentPrice = tokenPerformance.price;
    const price24hChange = tokenPerformance.price24hChange;

    return Math.abs(price24hChange - avgTokenPerformance);
}

function isSuspiciousVolume({
    uniqueWallet24h,
    volume24h,
}: TokenMarketData): boolean {
    return uniqueWallet24h / volume24h > 0.5;
}

function isSustainedGrowth({ volume24hChange }: TokenMarketData): boolean {
    return volume24hChange > 50;
}

function isRapidDump({ trades24hChange }: TokenMarketData): boolean {
    return trades24hChange < -50;
}

function calculateCheckTrustScore(
    tokenSecurityData: TokenSecurityData
): TokenSecurityData {
    //TODO: implement?
    return tokenSecurityData;
}
