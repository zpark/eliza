// TODO: Consolidate
// Recommenders are just entities, who we should already be tracking
// Add a component to recomenders when we start tracking them

import { v4 as uuidv4 } from "uuid";
import {
    // TransactionRow,
    Account,
    Optional,
    Position,
    // PositionRow,
    Recommender,
    RecommenderMetrics,
    RecommenderMetricsHistory,
    // RecommenderMetricsRow,
    TokenPerformance,
    // TokenPerformanceRow,
    TokenRecommendation,
    // ToSQLiteRecord,
    Transaction,
} from "./types";
// Table schema goes here
import { Memory, UUID } from "@elizaos/core";
import {
    and,
    avg,
    count,
    desc,
    eq,
    ExtractTablesWithRelations,
    gte,
    // Placeholder,
    inArray,
    isNull,
    lte,
    max,
    or,
    sql,
} from "drizzle-orm";
import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import {
    bigint,
    boolean,
    integer,
    jsonb,
    pgTable,
    PgTransaction,
    primaryKey,
    real,
    text,
    timestamp
} from "drizzle-orm/pg-core";

export class TrustScoreDatabase {
    constructor(private db: DB) {
        this.db = db;

        // load(db);
        // check if the tables exist, if not create them
        const requiredTables = [];

        //    const existingTables = this.db
        //        .prepare(
        //            `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => "?").join(",")});`
        //        )
        //        .all(...requiredTables);

        //  if (existingTables.length !== requiredTables.length) {
        //      this.initializeSchema();
        //  }
    }

    async transaction<T>(
        callback: (
            tx: PgTransaction<
                NodePgQueryResultHKT,
                typeof schema,
                ExtractTablesWithRelations<typeof schema>
            >
        ) => Promise<T>
    ): Promise<T> {
        return this.db.transaction(callback);
    }

    /**
     * Adds a new recommender to the database.
     * @param recommender Recommender object
     * @returns boolean indicating success
     */
    private async addRecommender(
        recommender: Recommender
    ): Promise<UUID | null> {
        try {
            // First try to find existing recommender
            const existing = await this.getRecommenderByPlatform(
                recommender.platform,
                recommender.userId
            );
            if (existing) return existing.id;

            // First ensure the account exists
            await this.db
                .insert(schema.accounts)
                .values({
                    id: recommender.userId,
                    username: recommender.username,
                    email: `${recommender.userId}@${recommender.platform}.com`,
                    avatarUrl: "",
                    details: {},
                })
                .onConflictDoNothing();

            // Then insert the recommender
            const result = await this.db
                .insert(schema.recommenders)
                .values({
                    id: recommender.id,
                    platform: recommender.platform,
                    userId: recommender.userId,
                    username: recommender.username,
                })
                .returning();

            return result[0]?.id as UUID | null;
        } catch (error) {
            console.error("Error adding recommender:", error);
            return null;
        }
    }

    /**
     * Retrieves a recommender by user ID.
     * @param userId User's ID
     * @returns Recommender object or null
     */

    async getRecommenderByUserId(userId: string): Promise<Recommender | null> {
        const recommender = await this.db
            .select()
            .from(schema.recommenders)
            .where(eq(schema.recommenders.userId, userId))
            .limit(1);

        return recommender[0] as Recommender | null;
    }

    /**
     * Retrieves a recommender by any identifier.
     * @param identifier Any of the recommender's identifiers
     * @returns Recommender object or null
     */
    async getRecommender(id: UUID): Promise<Recommender | null> {
        const recommender = await this.db
            .select()
            .from(schema.recommenders)
            .where(eq(schema.recommenders.id, id))
            .limit(1);

        return recommender[0] as Recommender | null;
    }
    /**
     * Retrieves a recommender by any identifier.
     * @param identifier Any of the recommender's identifiers
     * @returns Recommender object or null
     */
    async getRecommenderByPlatform(
        platform: string,
        userId: string
    ): Promise<Recommender | null> {
        const recommender = await this.db
            .select()
            .from(schema.recommenders)
            .where(
                and(
                    eq(schema.recommenders.platform, platform),
                    eq(schema.recommenders.userId, userId)
                )
            )
            .limit(1);

        return recommender[0] as Recommender | null;
    }

    private async createAndInitializeRecommender(
        recommender: Recommender
    ): Promise<Recommender> {
        const newRecommenderId = await this.addRecommender(recommender);
        if (!newRecommenderId) throw new Error("Failed to add new recommender");

        await this.initializeRecommenderMetrics(newRecommenderId);

        // Retrieve and return the newly created recommender
        const newRecommender = await this.getRecommender(newRecommenderId);
        return newRecommender!;
    }

    /**
     * Retrieves an existing recommender or creates a new one if not found.
     * Also initializes metrics for the recommender if they haven't been initialized yet.
     * @param recommender Recommender object containing at least one identifier
     * @returns Recommender object with all details, or null if failed
     */
    async getOrCreateRecommender(
        recommender: Optional<Recommender, "id">
    ): Promise<Recommender> {
        await this.getAccountByPlatformIdOrUserId(
            recommender.platform,
            recommender.userId,
            recommender.clientId,
            recommender.username
        );

        const existingRecommender = recommender.id
            ? await this.getRecommender(recommender.id)
            : await this.getRecommenderByUserId(recommender.userId);

        if (existingRecommender) {
            return existingRecommender;
        }

        return this.createAndInitializeRecommender({
            ...recommender,
            id: recommender.id ?? (uuidv4() as UUID),
        });
    }

    /**
     * Retrieves an account by platform-specific ID or username.
     * If an account with the username exists but has no platform-specific ID or clientId, it will be linked.
     */
    private async getAccountByPlatformIdOrUserId(
        platform: string,
        userId: string,
        clientId: string | undefined,
        username: string
    ): Promise<Account | null> {
        // Step 1: Try to find the account by platform-specific ID
        const account = await this.getAccountByPlatformIdOrUsername(
            platform,
            userId,
            username
        );
        if (account) {
            // Check if the account has no platform-specific ID or clientId
            const platformIdField =
                platform === "telegram"
                    ? "telegramId"
                    : platform === "discord"
                      ? "discordId"
                      : null;
            if (platformIdField && !account[platformIdField]) {
                try {
                    // Update the account with the platform-specific ID and clientId
                    await this.updateAccountPlatformIdAndClientId(
                        account.id,
                        platform,
                        clientId
                    );
                } catch (error) {
                    console.error(
                        `Failed to update account ${account.id} with platform ID:`,
                        error
                    );
                }
                return account;
            }
        }

        // Step 3: If no account is found, return null
        return null;
    }

    /**
     * Updates the platform-specific ID and clientId for an account.
     */
    private async updateAccountPlatformIdAndClientId(
        accountId: UUID,
        platform: string,
        clientId: string | undefined
    ): Promise<void> {
        if (!clientId) {
            throw new Error(
                "clientId is required to update the platform-specific ID"
            );
        }

        const updateData: Partial<Account> = {
            [platform === "telegram" ? "telegramId" : "discordId"]: clientId,
        };

        try {
            await this.db
                .update(schema.accounts)
                .set(updateData)
                .where(eq(schema.accounts.id, accountId));
        } catch (error) {
            console.error(
                `Failed to update account ${accountId} with platform ID:`,
                error
            );
            throw error;
        }
    }

    /**
     * Retrieves an account by its platform-specific ID (e.g., telegramId, discordId).
     * Or by username if the platform-specific ID is not available.
     */

    private async getAccountByPlatformIdOrUsername(
        platform: string,
        userId: string,
        username: string
    ): Promise<Account | null> {
        const platformIdField =
            platform === "telegram" ? "telegramId" : "discordId";

        const result = await this.db
            .select()
            .from(schema.accounts)
            .where(
                or(
                    eq(schema.accounts[platformIdField], userId),
                    eq(schema.accounts.username, username)
                )
            )
            .limit(1);

        return result[0] as unknown as Account | null;
    }

    /**
     * Initializes metrics for a recommender if not present.
     * @param recommenderId Recommender's UUID
     */
    async initializeRecommenderMetrics(
        recommenderId: string
    ): Promise<boolean> {
        try {
            const result = await this.db
                .insert(schema.recommenderMetrics)
                .values({
                    recommenderId: recommenderId,
                })
                .onConflictDoNothing()
                .returning();

            return result.length > 0;
        } catch (error) {
            console.error("Error initializing recommender metrics:", error);
            return false;
        }
    }

    async getRecommenderMetrics(
        recommenderId: string
    ): Promise<RecommenderMetrics | undefined> {
        const recommenderMetrics = await this.db
            .select()
            .from(schema.recommenderMetrics)
            .where(eq(schema.recommenderMetrics.recommenderId, recommenderId))
            .limit(1);

        const row = recommenderMetrics[0] || undefined;

        if (!row) return undefined;

        return {
            ...row,
            recommenderId: row.recommenderId as UUID,
            updatedAt: new Date(row.updatedAt ?? new Date()),
            lastActiveDate: new Date(row.lastActiveDate ?? new Date()),
            trustScore: row.trustScore ?? 0,
            totalRecommendations: row.totalRecommendations ?? 0,
            successfulRecs: row.successfulRecs ?? 0,
            avgTokenPerformance: row.avgTokenPerformance ?? 0,
            riskScore: row.riskScore ?? 0,
            consistencyScore: row.consistencyScore ?? 0,
            virtualConfidence: row.virtualConfidence ?? 0,
            trustDecay: row.trustDecay ?? 0,
        };
    }

    /**
     * Logs the current metrics of a recommender into the history table.
     * @param recommenderId Recommender's UUID
     */
    async logRecommenderMetricsHistory(recommenderId: string): Promise<void> {
        // Retrieve current metrics
        const currentMetrics = await this.getRecommenderMetrics(recommenderId);
        if (!currentMetrics) {
            console.warn(
                `No metrics found for recommender ID: ${recommenderId}`
            );
            return;
        }

        // Create a history entry
        const history: RecommenderMetricsHistory = {
            historyId: uuidv4() as UUID,
            recordedAt: new Date(), // Current timestamp
            ...currentMetrics,
        };

        // Insert into recommender_metrics_history table
        try {
            await this.db.insert(schema.recommenderMetricsHistory).values({
                historyId: history.historyId,
                recommenderId: history.recommenderId,
                trustScore: history.trustScore,
                totalRecommendations: history.totalRecommendations,
                successfulRecs: history.successfulRecs,
                avgTokenPerformance: history.avgTokenPerformance,
                riskScore: history.riskScore,
                consistencyScore: history.consistencyScore,
                recordedAt: history.recordedAt,
            });

            console.log(
                `Logged metrics history for recommender ID: ${recommenderId}`
            );
        } catch (error) {
            console.error("Error logging recommender metrics history:", error);
        }
    }

    /**
     * Updates metrics for a recommender.
     * @param metrics RecommenderMetrics object
     */
    async updateRecommenderMetrics(metrics: RecommenderMetrics): Promise<void> {
        // Log current metrics before updating
        await this.logRecommenderMetricsHistory(metrics.recommenderId);

        try {
            await this.db
                .update(schema.recommenderMetrics)
                .set({
                    trustScore: metrics.trustScore,
                    totalRecommendations: metrics.totalRecommendations,
                    successfulRecs: metrics.successfulRecs,
                    avgTokenPerformance: metrics.avgTokenPerformance,
                    riskScore: metrics.riskScore,
                    consistencyScore: metrics.consistencyScore,
                    updatedAt: new Date(),
                })
                .where(
                    eq(
                        schema.recommenderMetrics.recommenderId,
                        metrics.recommenderId
                    )
                );

            console.log(
                `Updated metrics for recommender ID: ${metrics.recommenderId}`
            );
        } catch (error) {
            console.error("Error updating recommender metrics:", error);
        }
    }

    // ----- TokenPerformance Methods -----

    /**
     * Adds or updates token performance metrics.
     * @param performance TokenPerformance object
     */
    async upsertTokenPerformance(
        token: Omit<TokenPerformance, "createdAt" | "initialMarketCap">
    ): Promise<boolean> {
        try {
            await this.db
                .insert(schema.tokenPerformance)
                .values({
                    chain: token.chain,
                    address: token.address ?? "",
                    name: token.name,
                    symbol: token.symbol,
                    decimals: token.decimals,
                    metadata: JSON.stringify(token.metadata),
                    price: token.price,
                    price24hChange: token.price24hChange,
                    volume: token.volume,
                    volume24hChange: token.volume24hChange,
                    trades: token.trades,
                    trades24hChange: token.trades24hChange,
                    liquidity: token.liquidity,
                    holders: token.holders,
                    rugPull: token.rugPull,
                    isScam: token.isScam,
                    sustainedGrowth: token.sustainedGrowth,
                    rapidDump: token.rapidDump,
                    suspiciousVolume: token.suspiciousVolume,
                    validationTrust: token.validationTrust,
                    initialMarketCap: token.currentMarketCap, // Using currentMarketCap as initial on insert
                    currentMarketCap: token.currentMarketCap,
                    createdAt: token.updatedAt,
                    updatedAt: token.updatedAt,
                })
                .onConflictDoUpdate({
                    target: [
                        schema.tokenPerformance.chain,
                        schema.tokenPerformance.address,
                    ],
                    set: {
                        name: token.name,
                        symbol: token.symbol,
                        decimals: token.decimals,
                        metadata: JSON.stringify(token.metadata),
                        price: token.price,
                        price24hChange: token.price24hChange,
                        volume: token.volume,
                        volume24hChange: token.volume24hChange,
                        trades: token.trades,
                        trades24hChange: token.trades24hChange,
                        liquidity: token.liquidity,
                        holders: token.holders,
                        currentMarketCap: token.currentMarketCap,
                        rugPull: token.rugPull,
                        isScam: token.isScam,
                        sustainedGrowth: token.sustainedGrowth,
                        rapidDump: token.rapidDump,
                        suspiciousVolume: token.suspiciousVolume,
                        validationTrust: token.validationTrust,
                        updatedAt: token.updatedAt,
                    },
                });

            console.log(`Upserted token performance for ${token.address}`);
            return true;
        } catch (error) {
            console.error("Error upserting token performance:", error);
            return false;
        }
    }

    /**
     * Retrieves token performance metrics.
     * @param tokenAddress Token's address
     * @returns TokenPerformance object or null
     */
    async getTokenPerformance(
        chain: string,
        tokenAddress: string
    ): Promise<TokenPerformance | null> {
        const tokenPerformance = await this.db
            .select()
            .from(schema.tokenPerformance)
            .where(
                and(
                    eq(schema.tokenPerformance.chain, chain),
                    eq(schema.tokenPerformance.address, tokenAddress)
                )
            )
            .limit(1);

        const row = tokenPerformance[0] || undefined;
        if (!row) return null;

        return {
            ...row,
            metadata: row.metadata ?? {},
            name: row.name ?? "",
            symbol: row.symbol ?? "",
            decimals: row.decimals ?? 0,
            price: row.price ?? 0,
            price24hChange: row.price24hChange ?? 0,
            volume: row.volume ?? 0,
            volume24hChange: row.volume24hChange ?? 0,
            trades: row.trades ?? 0,
            trades24hChange: row.trades24hChange ?? 0,
            liquidity: row.liquidity ?? 0,
            holders: row.holders ?? 0,
            holders24hChange: row.holders24hChange ?? 0,
            initialMarketCap: row.initialMarketCap ?? 0,
            currentMarketCap: row.currentMarketCap ?? 0,
            rugPull: Boolean(row.rugPull),
            isScam: Boolean(row.isScam),
            sustainedGrowth: Boolean(row.sustainedGrowth),
            suspiciousVolume: Boolean(row.suspiciousVolume),
            rapidDump: Boolean(row.rapidDump),
            validationTrust: row.validationTrust ?? 0,
            updatedAt: new Date(row.updatedAt ?? new Date()),
            createdAt: new Date(row.createdAt ?? new Date()),
        };
    }

    async getOpenPositions(): Promise<Position[]> {
        const positions = await this.db
            .select()
            .from(schema.positions)
            .where(isNull(schema.positions.closedAt));

        return positions.map((row) => ({
            ...row,
            id: row.id as UUID,
            recommenderId: row.recommenderId as UUID,
            recommendationId: row.recommendationId as UUID,
            openedAt: new Date(row.openedAt ?? new Date()),
            updatedAt: new Date(row.updatedAt ?? new Date()),
            closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
            isSimulation: Boolean(row.isSimulation),
            rapidDump: Boolean(row.rapidDump),
            initialPrice: row.initialPrice ?? "0",
            initialMarketCap: row.initialMarketCap ?? "0",
            initialLiquidity: row.initialLiquidity ?? "0",
            performanceScore: row.performanceScore ?? 0,
            metadata: row.metadata ?? {},
        }));
    }

    //get opne positions by recommender
    async getOpenPositionsByRecommenderAndToken(
        RecommenderId: string,
        tokenAddress: string
    ): Promise<Position[]> {
        const positions = await this.db
            .select()
            .from(schema.positions)
            .where(
                and(
                    eq(schema.positions.recommenderId, RecommenderId),
                    eq(schema.positions.tokenAddress, tokenAddress),
                    isNull(schema.positions.closedAt)
                )
            );

        return positions.map((row) => ({
            ...row,
            id: row.id as UUID,
            recommenderId: row.recommenderId as UUID,
            recommendationId: row.recommendationId as UUID,
            openedAt: new Date(row.openedAt ?? new Date()),
            updatedAt: new Date(row.updatedAt ?? new Date()),
            closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
            isSimulation: Boolean(row.isSimulation),
            rapidDump: Boolean(row.rapidDump),
            initialPrice: row.initialPrice ?? "0",
            initialMarketCap: row.initialMarketCap ?? "0",
            initialLiquidity: row.initialLiquidity ?? "0",
            performanceScore: row.performanceScore ?? 0,
            metadata: row.metadata ?? {},
        }));
    }

    // ----- TokenRecommendations Methods -----

    /**
     * Calculates the average trust score of all recommenders who have recommended a specific token.
     * @param tokenAddress The address of the token.
     * @returns Promise<number> The average trust score (validationTrust).
     */
    async calculateValidationTrust(
        chain: string,
        tokenAddress: string
    ): Promise<number> {
        const rows = await this.db
            .select({ trustScore: schema.recommenderMetrics.trustScore })
            .from(schema.tokenRecommendations)
            .innerJoin(
                schema.recommenderMetrics,
                eq(
                    schema.tokenRecommendations.recommenderId,
                    schema.recommenderMetrics.recommenderId
                )
            )
            .where(
                and(
                    eq(schema.tokenRecommendations.chain, chain),
                    eq(schema.tokenRecommendations.address, tokenAddress)
                )
            );

        if (rows.length === 0) return 0;

        const totalTrust = rows.reduce(
            (acc, row) => acc + (row.trustScore ?? 0),
            0
        );
        return totalTrust / rows.length;
    }

    /**
     * Adds a new token recommendation.
     * @param recommendation TokenRecommendation object
     * @returns Promise<boolean> indicating success
     */
    async addTokenRecommendation(
        recommendation: TokenRecommendation,
        tx?: PgTransaction<
            NodePgQueryResultHKT,
            typeof schema,
            ExtractTablesWithRelations<typeof schema>
        >
    ): Promise<boolean> {
        try {
            const query = tx ?? this.db;
            await query
                .insert(schema.tokenRecommendations)
                .values({
                    id: recommendation.id,
                    recommenderId: recommendation.recommenderId,
                    chain: recommendation.chain,
                    address: recommendation.tokenAddress,
                    initialPrice: Number(recommendation.price),
                    price: Number(recommendation.price),
                    initialMarketCap: Number(recommendation.marketCap),
                    marketCap: Number(recommendation.marketCap),
                    initialLiquidity: Number(recommendation.liquidity),
                    liquidity: Number(recommendation.liquidity),
                    metadata: JSON.stringify(recommendation.metadata),
                    status: recommendation.status,
                    conviction: recommendation.conviction,
                    tradeType: recommendation.type,
                    createdAt: recommendation.createdAt,
                    updatedAt: recommendation.updatedAt,
                })
                .onConflictDoNothing();
            return true;
        } catch (error) {
            console.error("Error adding token recommendation:", error);
            return false;
        }
    }

    async updateTokenRecommendation(
        recommendation: TokenRecommendation,
        tx?: PgTransaction<
            NodePgQueryResultHKT,
            typeof schema,
            ExtractTablesWithRelations<typeof schema>
        >
    ): Promise<boolean> {
        try {
            const query = tx ?? this.db;
            await query
                .update(schema.tokenRecommendations)
                .set({
                    marketCap: Number(recommendation.marketCap),
                    liquidity: Number(recommendation.liquidity),
                    price: Number(recommendation.price),
                    riskScore: Number(recommendation.riskScore),
                    performanceScore: Number(recommendation.performanceScore),
                    updatedAt: recommendation.updatedAt,
                    metadata: JSON.stringify(recommendation.metadata) ?? "{}",
                })
                .where(eq(schema.tokenRecommendations.id, recommendation.id));
            console.log("updated token recommendation", recommendation.id);
            return true;
        } catch (error) {
            console.error("Error adding token recommendation:", error);
            return false;
        }
    }

    /**
     * Retrieves all recommendations made by a recommender.
     * @param recommenderId Recommender's UUID
     * @returns Promise<TokenRecommendation[]> Array of TokenRecommendation objects
     */
    async getRecommendationsByRecommender(
        recommenderId: string,
        tx?: PgTransaction<
            NodePgQueryResultHKT,
            typeof schema,
            ExtractTablesWithRelations<typeof schema>
        >
    ): Promise<TokenRecommendation[]> {
        const query = tx ?? this.db;
        const rows = await query
            .select()
            .from(schema.tokenRecommendations)
            .where(eq(schema.tokenRecommendations.recommenderId, recommenderId))
            .orderBy(desc(schema.tokenRecommendations.createdAt));

        if (!rows) return [];

        return rows.map((row) => ({
            id: row.id as UUID,
            recommenderId: row.recommenderId as UUID,
            chain: row.chain,
            tokenAddress: row.address,
            conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
            type: row.tradeType as
                | "BUY"
                | "DONT_BUY"
                | "SELL"
                | "DONT_SELL"
                | "NONE",
            initialMarketCap: String(row.initialMarketCap ?? "0"),
            initialLiquidity: String(row.initialLiquidity ?? "0"),
            initialPrice: String(row.initialPrice ?? "0"),
            marketCap: String(row.marketCap ?? "0"),
            liquidity: String(row.liquidity ?? "0"),
            price: String(row.price ?? "0"),
            rugPull: Boolean(row.rugPull),
            isScam: Boolean(row.isScam),
            riskScore: row.riskScore ?? 0,
            performanceScore: row.performanceScore ?? 0,
            metadata: row.metadata ?? {},
            status: row.status as
                | "ACTIVE"
                | "COMPLETED"
                | "EXPIRED"
                | "WITHDRAWN",
            createdAt: new Date(row.createdAt ?? new Date()),
            updatedAt: new Date(row.updatedAt ?? new Date()),
        }));
    }

    async calculateRecommenderMetrics(recommenderId: string): Promise<{
        totalRecommendations: number;
        lastActiveDate: Date;
        avgTokenPerformance: number;
        trustScore: number;
        successfulRecs: number;
        riskScore: number;
    }> {
        const result = await this.db
            .select({
                totalRecommendations: count(),
                lastActiveDate: max(schema.tokenRecommendations.createdAt),
                avgTokenPerformance: avg(
                    schema.tokenRecommendations.performanceScore
                ),
                riskScore: avg(schema.tokenRecommendations.riskScore),
                trustScore: sql<number>`LEAST(GREATEST(SUM(${schema.tokenRecommendations.performanceScore}) - SUM(${schema.tokenRecommendations.riskScore}), 0), 100)`,
                successfulRecs: sql<number>`SUM(CASE WHEN ${schema.tokenRecommendations.performanceScore} > 0 THEN 1 ELSE 0 END)`,
            })
            .from(schema.tokenRecommendations)
            .where(
                eq(schema.tokenRecommendations.recommenderId, recommenderId)
            );

        const {
            totalRecommendations,
            lastActiveDate,
            avgTokenPerformance,
            riskScore,
            trustScore,
            successfulRecs,
        } = result[0];

        // Default trustScore to 0 if there are no recommendations
        const finalTrustScore =
            totalRecommendations > 0 ? Number(trustScore ?? 0) : 0;

        return {
            totalRecommendations,
            avgTokenPerformance: Number(avgTokenPerformance ?? 0),
            riskScore: Number(riskScore ?? 0),
            trustScore: finalTrustScore,
            successfulRecs: Number(successfulRecs ?? 0),
            lastActiveDate: lastActiveDate ?? new Date(),
        };
    }

    /**
     * Retrieves all recommendations for a specific token.
     * @param tokenAddress Token's address
     * @returns Promise<TokenRecommendation[]> Array of TokenRecommendation objects
     */
    async getRecommendationsByToken(
        tokenAddress: string
    ): Promise<TokenRecommendation[]> {
        const rows = await this.db
            .select()
            .from(schema.tokenRecommendations)
            .where(eq(schema.tokenRecommendations.address, tokenAddress))
            .orderBy(desc(schema.tokenRecommendations.createdAt));

        return rows.map((row) => ({
            id: row.id as UUID,
            recommenderId: row.recommenderId as UUID,
            chain: row.chain,
            tokenAddress: row.address,
            conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
            type: row.tradeType as
                | "BUY"
                | "DONT_BUY"
                | "SELL"
                | "DONT_SELL"
                | "NONE",
            initialMarketCap: String(row.initialMarketCap ?? "0"),
            initialLiquidity: String(row.initialLiquidity ?? "0"),
            initialPrice: String(row.initialPrice ?? "0"),
            marketCap: String(row.marketCap ?? "0"),
            liquidity: String(row.liquidity ?? "0"),
            price: String(row.price ?? "0"),
            rugPull: Boolean(row.rugPull),
            isScam: Boolean(row.isScam),
            riskScore: row.riskScore ?? 0,
            performanceScore: row.performanceScore ?? 0,
            metadata: JSON.parse(row.metadata as string) ?? {},
            status: row.status as
                | "ACTIVE"
                | "COMPLETED"
                | "EXPIRED"
                | "WITHDRAWN",
            createdAt: new Date(row.createdAt ?? new Date()),
            updatedAt: new Date(row.updatedAt ?? new Date()),
        }));
    }

    /**
     * Retrieves all recommendations within a specific timeframe.
     * @param startDate Start date
     * @param endDate End date
     * @returns Array of TokenRecommendation objects
     */
    async getRecommendationsByDateRange(
        startDate: Date,
        endDate: Date
    ): Promise<TokenRecommendation[]> {
        const rows = await this.db
            .select()
            .from(schema.tokenRecommendations)
            .where(
                and(
                    gte(schema.tokenRecommendations.createdAt, startDate),
                    lte(schema.tokenRecommendations.createdAt, endDate)
                )
            )
            .orderBy(desc(schema.tokenRecommendations.createdAt));

        return rows.map((row) => ({
            id: row.id as UUID,
            recommenderId: row.recommenderId as UUID,
            chain: row.chain,
            tokenAddress: row.address,
            conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
            type: row.tradeType as
                | "BUY"
                | "DONT_BUY"
                | "SELL"
                | "DONT_SELL"
                | "NONE",
            initialMarketCap: String(row.initialMarketCap ?? "0"),
            initialLiquidity: String(row.initialLiquidity ?? "0"),
            initialPrice: String(row.initialPrice ?? "0"),
            marketCap: String(row.marketCap ?? "0"),
            liquidity: String(row.liquidity ?? "0"),
            price: String(row.price ?? "0"),
            rugPull: Boolean(row.rugPull),
            isScam: Boolean(row.isScam),
            riskScore: row.riskScore ?? 0,
            performanceScore: row.performanceScore ?? 0,
            metadata: JSON.parse(row.metadata as string) ?? {},
            status: row.status as
                | "ACTIVE"
                | "COMPLETED"
                | "EXPIRED"
                | "WITHDRAWN",
            createdAt: new Date(row.createdAt ?? new Date()),
            updatedAt: new Date(row.updatedAt ?? new Date()),
        }));
    }

    /**
     * Retrieves historical metrics for a recommender.
     * @param recommenderId Recommender's UUID
     * @returns Array of RecommenderMetricsHistory objects
     */
    async getRecommenderMetricsHistory(
        recommenderId: string
    ): Promise<RecommenderMetricsHistory[]> {
        const rows = await this.db
            .select()
            .from(schema.recommenderMetricsHistory)
            .where(
                eq(
                    schema.recommenderMetricsHistory.recommenderId,
                    recommenderId
                )
            )
            .orderBy(desc(schema.recommenderMetricsHistory.recordedAt));

        return rows.map((row) => ({
            historyId: row.historyId as UUID,
            recommenderId: row.recommenderId,
            trustScore: row.trustScore ?? 0,
            totalRecommendations: row.totalRecommendations ?? 0,
            successfulRecs: row.successfulRecs ?? 0,
            avgTokenPerformance: row.avgTokenPerformance ?? 0,
            riskScore: row.riskScore ?? 0,
            consistencyScore: row.consistencyScore ?? 0,
            virtualConfidence: row.virtualConfidence ?? 0,
            trustDecay: 0,
            recordedAt: new Date(row.recordedAt ?? new Date()),
        }));
    }

    async createPosition(position: Position): Promise<boolean> {
        try {
            await this.db.insert(schema.positions).values({
                id: position.id,
                walletAddress: position.walletAddress,
                isSimulation: position.isSimulation,
                chain: position.chain,
                tokenAddress: position.tokenAddress,
                recommenderId: position.recommenderId,
                recommendationId: position.recommendationId,
                initialPrice: position.initialPrice,
                initialMarketCap: position.initialMarketCap,
                initialLiquidity: position.initialLiquidity,
                rapidDump: position.rapidDump,
                openedAt: position.openedAt,
                updatedAt: position.updatedAt,
            });
            console.log(`Inserted position`, position);
            return true;
        } catch (error) {
            console.error(`Error inserting position`, error);
            return false;
        }
    }

    async getPosition(id: UUID): Promise<Position | null> {
        const position = await this.db
            .select()
            .from(schema.positions)
            .where(eq(schema.positions.id, id))
            .limit(1);

        const row = position[0] ?? null;
        if (!row) return null;

        return {
            id: row.id as UUID,
            chain: row.chain,
            tokenAddress: row.tokenAddress,
            walletAddress: row.walletAddress,
            isSimulation: Boolean(row.isSimulation),
            recommenderId: row.recommenderId as UUID,
            recommendationId: row.recommendationId as UUID,
            initialPrice: row.initialPrice ?? "0",
            initialMarketCap: row.initialMarketCap ?? "0",
            initialLiquidity: row.initialLiquidity ?? "0",
            performanceScore: row.performanceScore ?? 0,
            rapidDump: Boolean(row.rapidDump),
            openedAt: new Date(row.openedAt ?? new Date()),
            closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
            updatedAt: new Date(row.updatedAt ?? new Date()),
        };
    }

    async getPositionInvestment(id: UUID): Promise<bigint> {
        const position = await this.db
            .select({
                investedAmount: sql<string>`SUM(${schema.transactions.solAmount})`,
            })
            .from(schema.transactions)
            .where(
                and(
                    eq(schema.transactions.positionId, id),
                    eq(schema.transactions.type, "BUY")
                )
            )
            .limit(1);

        const row = position[0] ?? null;

        if (!row) return 0n;

        return BigInt(row.investedAmount ?? 0);
    }

    async getPositionBalance(id: UUID): Promise<bigint> {
        const position = await this.db
            .select({
                balance: sql<string>`
                    SUM(CASE
                        WHEN ${schema.transactions.type} = 'BUY' THEN ${schema.transactions.amount}
                        WHEN ${schema.transactions.type} = 'SELL' THEN -${schema.transactions.amount}
                        WHEN ${schema.transactions.type} = 'TRANSFER_IN' THEN ${schema.transactions.amount}
                        WHEN ${schema.transactions.type} = 'TRANSFER_OUT' THEN -${schema.transactions.amount}
                        ELSE 0
                    END)
                `,
            })
            .from(schema.transactions)
            .where(eq(schema.transactions.positionId, id))
            .limit(1);

        const row = position[0] ?? null;

        if (!row) return 0n;

        return BigInt(row.balance ?? 0);
    }

    async getOpenPositionsWithBalance(): Promise<any> {
        const rows = await this.db
            .select({
                id: schema.positions.id,
                chain: schema.positions.chain,
                tokenAddress: schema.positions.tokenAddress,
                walletAddress: schema.positions.walletAddress,
                isSimulation: schema.positions.isSimulation,
                recommenderId: schema.positions.recommenderId,
                recommendationId: schema.positions.recommendationId,
                initialPrice: schema.positions.initialPrice,
                initialMarketCap: schema.positions.initialMarketCap,
                initialLiquidity: schema.positions.initialLiquidity,
                performanceScore: schema.positions.performanceScore,
                rapidDump: schema.positions.rapidDump,
                openedAt: schema.positions.openedAt,
                closedAt: schema.positions.closedAt,
                updatedAt: schema.positions.updatedAt,
                balance: sql<string>`
                    COALESCE((
                        SELECT SUM(CASE
                            WHEN type = 'BUY' THEN amount
                            WHEN type = 'SELL' THEN -amount
                            WHEN type = 'TRANSFER_IN' THEN amount
                            WHEN type = 'TRANSFER_OUT' THEN -amount
                            ELSE 0
                        END)
                        FROM ${schema.transactions}
                        WHERE ${schema.transactions.positionId} = ${schema.positions.id}
                    ), 0)
                `,
            })
            .from(schema.positions)
            .where(isNull(schema.positions.closedAt));

        // filter out positions with 0 balance
        // rows.filter((row) => BigInt(row.balance) > 0n);
        if (rows.length === 0) return [];

        return rows.map((row) => ({
            balance: BigInt(row.balance),
            id: row.id as UUID,
            chain: row.chain,
            tokenAddress: row.tokenAddress,
            walletAddress: row.walletAddress,
            isSimulation: Boolean(row.isSimulation),
            recommenderId: row.recommenderId as UUID,
            recommendationId: row.recommendationId as UUID,
            initialPrice: row.initialPrice ?? "0",
            initialMarketCap: row.initialMarketCap ?? "0",
            initialLiquidity: row.initialLiquidity ?? "0",
            performanceScore: row.performanceScore ?? 0,
            rapidDump: Boolean(row.rapidDump),
            openedAt: new Date(row.openedAt ?? new Date()),
            closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
            updatedAt: new Date(row.updatedAt ?? new Date()),
        }));
    }

    // ----- Transactions Methods -----
    /**
     * Adds a new transaction to the database.
     * @param transaction Transaction object
     * @returns boolean indicating success
     */

    async addTransaction(transaction: Transaction): Promise<boolean> {
        try {
            await this.db.insert(schema.transactions).values({
                // @ts-ignore
                id: transaction.id,
                positionId: transaction.positionId,
                type: transaction.type,
                isSimulation: transaction.isSimulation,
                chain: transaction.chain,
                address: transaction.tokenAddress,
                transactionHash: transaction.transactionHash,
                amount: transaction.amount,
                valueUsd: transaction.valueUsd ?? null,
                price: transaction.price ?? null,
                solAmount: transaction.solAmount ?? null,
                solValueUsd: transaction.solValueUsd ?? null,
                solPrice: transaction.solPrice ?? null,
                marketCap: transaction.marketCap ?? null,
                liquidity: transaction.liquidity ?? null,
                timestamp: transaction.timestamp,
            });
            return true;
        } catch (error) {
            console.error("Error adding transaction:", error);
            return false;
        }
    }

    async getPositionTransactions(positionId: UUID): Promise<Transaction[]> {
        const rows = await this.db
            .select()
            .from(schema.transactions)
            .where(eq(schema.transactions.positionId, positionId));

        return rows.map((row) => ({
            id: row.id as UUID,
            type: row.type as "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT",
            positionId: row.positionId as UUID,
            isSimulation: Boolean(row.isSimulation),
            chain: row.chain,
            tokenAddress: row.address,
            transactionHash: row.transactionHash,
            amount: BigInt(row.amount),
            valueUsd: row.valueUsd ?? undefined,
            price: row.price ?? undefined,
            solAmount: row.solAmount ? BigInt(row.solAmount) : undefined,
            solValueUsd: row.solValueUsd ?? undefined,
            solPrice: row.solPrice ?? undefined,
            marketCap: row.marketCap ?? undefined,
            liquidity: row.liquidity ?? undefined,
            timestamp: new Date(row.timestamp ?? new Date()),
        }));
    }

    async getPositionsTransactions(
        positionIds: UUID[]
    ): Promise<Transaction[]> {
        const rows = await this.db
            .select()
            .from(schema.transactions)
            .where(inArray(schema.transactions.positionId, positionIds));

        return rows.map((row) => ({
            id: row.id as UUID,
            type: row.type as "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT",
            positionId: row.positionId as UUID,
            isSimulation: Boolean(row.isSimulation),
            chain: row.chain,
            tokenAddress: row.address,
            transactionHash: row.transactionHash,
            amount: BigInt(row.amount),
            valueUsd: row.valueUsd ?? undefined,
            price: row.price ?? undefined,
            solAmount: row.solAmount ? BigInt(row.solAmount) : undefined,
            solValueUsd: row.solValueUsd ?? undefined,
            solPrice: row.solPrice ?? undefined,
            marketCap: row.marketCap ?? undefined,
            liquidity: row.liquidity ?? undefined,
            timestamp: new Date(row.timestamp ?? new Date()),
        }));
    }

    async updatePosition(position: Position): Promise<boolean> {
        try {
            await this.db
                .update(schema.positions)
                .set({
                    performanceScore: position.performanceScore,
                    updatedAt: position.updatedAt,
                })
                .where(eq(schema.positions.id, position.id));
            console.log(`Updated position`, position);
            return true;
        } catch (error) {
            console.error(`Error updating position`, error);
            return false;
        }
    }

    async touchPosition(id: UUID) {
        try {
            await this.db
                .update(schema.positions)
                .set({
                    updatedAt: new Date(),
                })
                .where(eq(schema.positions.id, id));
        } catch (error) {}
    }

    async closePosition(id: UUID) {
        try {
            await this.db
                .update(schema.positions)
                .set({
                    closedAt: new Date(),
                })
                .where(eq(schema.positions.id, id));
        } catch (error) {}
    }

    async closePositions(ids: UUID[]) {
        try {
            await this.db
                .update(schema.positions)
                .set({
                    closedAt: new Date(),
                })
                .where(inArray(schema.positions.id, ids));
        } catch (error) {}
    }

    async getMessagesByUserId(
        userId: UUID,
        limit: number = 10
    ): Promise<Memory[]> {
        const rows = await this.db
            .select()
            .from(schema.memories)
            .where(
                and(
                    eq(schema.memories.userId, userId),
                    eq(schema.memories.type, "messages")
                )
            )
            .orderBy(desc(schema.memories.createdAt))
            .limit(limit);

        return rows.map((row) => ({
            id: row.id as UUID,
            userId: row.userId as UUID,
            roomId: row.roomId as UUID,
            agentId: row.agentId as UUID,
            createdAt: row.createdAt ? row.createdAt.getTime() : undefined,
            content: JSON.parse(row.content),
            type: row.type,
        }));
    }
}

export const positions = pgTable("positions", {
    id: text("id").primaryKey(),
    isSimulation: boolean("isSimulation").default(false),
    walletAddress: text("walletAddress").notNull(),
    chain: text("chain").notNull(),
    tokenAddress: text("tokenAddress").notNull(),
    recommenderId: text("recommenderId")
        .references(() => entityTable.id)
        .notNull(),
    recommendationId: text("recommendationId")
        .references(() => tokenRecommendations.id)
        .notNull(),
    initialPrice: text("initialPrice").notNull(),
    initialMarketCap: text("initialMarketCap").notNull(),
    initialLiquidity: text("initialLiquidity").notNull(),
    performanceScore: real("performanceScore"),
    rapidDump: boolean("rapidDump").default(false),
    metadata: jsonb("metadata").default("{}"),
    openedAt: timestamp("openedAt"),
    closedAt: timestamp("closedAt"),
    updatedAt: timestamp("updatedAt"),
});

export const recommenderMetrics = pgTable("recommender_metrics", {
    recommenderId: text("recommenderId")
        .references(() => entityTable.id)
        .primaryKey(),
    trustScore: real("trustScore"),
    totalRecommendations: integer("totalRecommendations"),
    successfulRecs: integer("successfulRecs"),
    avgTokenPerformance: real("avgTokenPerformance"),
    riskScore: real("riskScore"),
    consistencyScore: real("consistencyScore"),
    virtualConfidence: real("virtualConfidence"),
    // Double check this type
    lastActiveDate: timestamp("lastActiveDate"),
    trustDecay: real("trustDecay"),
    updatedAt: timestamp("updatedAt"),
});

export const recommenderMetricsHistory = pgTable(
    "recommender_metrics_history",
    {
        historyId: text("historyId").primaryKey(),
        recommenderId: text("recommenderId")
            .references(() => entityTable.id)
            .notNull(),
        trustScore: real("trustScore"),
        totalRecommendations: integer("totalRecommendations"),
        successfulRecs: integer("successfulRecs"),
        avgTokenPerformance: real("avgTokenPerformance"),
        riskScore: real("riskScore"),
        consistencyScore: real("consistencyScore"),
        virtualConfidence: real("virtualConfidence").default(0),
        recordedAt: timestamp("recordedAt").defaultNow(),
    }
);

export const tokenPerformance = pgTable(
    "token_performance",
    {
        chain: text("chain").notNull(),
        address: text("address").notNull(),
        name: text("name"),
        symbol: text("symbol"),
        decimals: integer("decimals"),
        metadata: jsonb("metadata").default("{}"),
        price: real("price").default(0),
        price24hChange: real("price24hChange").default(0),
        volume: real("volume").default(0),
        volume24hChange: real("volume24hChange").default(0),
        trades: real("trades").default(0),
        trades24hChange: real("trades24hChange").default(0),
        liquidity: real("liquidity").default(0),
        initialMarketCap: real("initialMarketCap").default(0),
        currentMarketCap: real("currentMarketCap").default(0),
        holders: real("holders").default(0),
        holders24hChange: real("holders24hChange").default(0),
        rugPull: boolean("rugPull").default(false),
        isScam: boolean("isScam").default(false),
        sustainedGrowth: boolean("sustainedGrowth").default(false),
        rapidDump: boolean("rapidDump").default(false),
        suspiciousVolume: boolean("suspiciousVolume").default(false),
        validationTrust: real("validationTrust").default(0),
        createdAt: timestamp("createdAt").defaultNow(),
        updatedAt: timestamp("updatedAt").defaultNow(),
    },
    (table) => [primaryKey({ columns: [table.chain, table.address] })]
);

export const tokenRecommendations = pgTable("token_recommendations", {
    id: text("id").primaryKey(),
    recommenderId: text("recommenderId")
        .references(() => entityTable.id)
        .notNull(),
    chain: text("chain").notNull(),
    address: text("address").notNull(),
    initialPrice: real("initialPrice").notNull(),
    price: real("price").notNull(),
    initialMarketCap: real("initialMarketCap").notNull(),
    marketCap: real("marketCap").notNull(),
    initialLiquidity: real("initialLiquidity").notNull(),
    liquidity: real("liquidity").notNull(),
    rugPull: boolean("rugPull").default(false),
    isScam: boolean("isScam").default(false),
    riskScore: real("riskScore").default(0),
    performanceScore: real("performanceScore").default(0),
    metadata: jsonb("metadata").default("{}"),
    status: text("status").notNull(),
    conviction: text("conviction").notNull(),
    tradeType: text("tradeType").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow(),
});

export const transactions = pgTable("transactions", {
    id: text("id").primaryKey(),
    positionId: text("positionId").references(() => positions.id),
    type: text("type").notNull(),
    isSimulation: boolean("isSimulation").default(false),
    chain: text("chain").notNull(),
    address: text("address").notNull(),
    transactionHash: text("transactionHash").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    valueUsd: text("valueUsd"),
    price: text("price"),
    solAmount: bigint("solAmount", { mode: "number" }),
    solValueUsd: text("solValueUsd"),
    solPrice: text("solPrice"),
    marketCap: text("marketCap"),
    liquidity: text("liquidity"),
    timestamp: timestamp("timestamp").defaultNow(),
});