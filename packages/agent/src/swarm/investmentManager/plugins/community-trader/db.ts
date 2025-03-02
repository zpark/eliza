// TODO: This needs to be rewritten entirely
// Recommenders are entities
// Any discord, telegram etc data is stored as components
// Metrics are stored as memories or cache items

import { UUID, Memory } from "@elizaos/core";
import { Database } from "better-sqlite3";
// Remove drizzle ORM, use existing database manager stuff
import {
    and,
    desc,
    eq,
    // Placeholder,
    inArray,
    isNull,
    sql
} from "drizzle-orm";

import { v4 as uuidv4 } from "uuid";
import { Position } from "./types";

export interface Recommender {
    id: string; // UUID
    address: string;
    solanaPubkey?: string;
    telegramId?: string;
    discordId?: string;
    twitterId?: string;
    ip?: string;
}

export interface RecommenderMetrics {
    recommenderId: string;
    trustScore: number;
    totalRecommendations: number;
    successfulRecs: number;
    avgTokenPerformance: number;
    riskScore: number;
    consistencyScore: number;
    virtualConfidence: number;
    lastActiveDate: Date;
    trustDecay: number;
    lastUpdated: Date;
}

export interface TokenPerformance {
    tokenAddress: string;
    symbol: string;
    priceChange24h: number;
    volumeChange24h: number;
    trade_24h_change: number;
    liquidity: number;
    liquidityChange24h: number;
    holderChange24h: number;
    rugPull: boolean;
    isScam: boolean;
    marketCapChange24h: number;
    sustainedGrowth: boolean;
    rapidDump: boolean;
    suspiciousVolume: boolean;
    validationTrust: number;
    balance: number;
    initialMarketCap: number;
    lastUpdated: Date;
}

export interface TokenRecommendation {
    id: string; // UUID
    recommenderId: string;
    tokenAddress: string;
    timestamp: Date;
    initialMarketCap?: number;
    initialLiquidity?: number;
    initialPrice?: number;
}
export interface RecommenderMetricsHistory {
    historyId: string; // UUID
    recommenderId: string;
    trustScore: number;
    totalRecommendations: number;
    successfulRecs: number;
    avgTokenPerformance: number;
    riskScore: number;
    consistencyScore: number;
    virtualConfidence: number;
    trustDecay: number;
    recordedAt: Date;
}

export interface TradePerformance {
    token_address: string;
    recommender_id: string;
    buy_price: number;
    sell_price: number;
    buy_timeStamp: string;
    sell_timeStamp: string;
    buy_amount: number;
    sell_amount: number;
    buy_sol: number;
    received_sol: number;
    buy_value_usd: number;
    sell_value_usd: number;
    profit_usd: number;
    profit_percent: number;
    buy_market_cap: number;
    sell_market_cap: number;
    market_cap_change: number;
    buy_liquidity: number;
    sell_liquidity: number;
    liquidity_change: number;
    last_updated: string;
    rapidDump: boolean;
}

interface RecommenderMetricsRow {
    recommender_id: string;
    trust_score: number;
    total_recommendations: number;
    successful_recs: number;
    avg_token_performance: number;
    risk_score: number;
    consistency_score: number;
    virtual_confidence: number;
    last_active_date: Date;
    trust_decay: number;
    last_updated: string;
}

interface TokenPerformanceRow {
    token_address: string;
    symbol: string;
    price_change_24h: number;
    volume_change_24h: number;
    trade_24h_change: number;
    liquidity: number;
    liquidity_change_24h: number;
    holder_change_24h: number;
    rug_pull: number;
    is_scam: number;
    market_cap_change24h: number;
    sustained_growth: number;
    rapid_dump: number;
    suspicious_volume: number;
    validation_trust: number;
    balance: number;
    initial_market_cap: number;
    last_updated: string;
}

interface Transaction {
    tokenAddress: string;
    transactionHash: string;
    type: "buy" | "sell";
    amount: number;
    price: number;
    isSimulation: boolean;
    timestamp: string;
}

export class TrustScoreDatabase {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        // load(db);
        // check if the tables exist, if not create them
        const tables = this.db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('recommenders', 'recommender_metrics', 'token_performance', 'token_recommendations', 'recommender_metrics_history');"
            )
            .all();
        if (tables.length !== 5) {
            this.initializeSchema();
        }
    }

    private initializeSchema() {
        // Enable Foreign Key Support
        this.db.exec(`PRAGMA foreign_keys = ON;`);

        // Create Recommenders Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS recommenders (
                id TEXT PRIMARY KEY,
                address TEXT UNIQUE NOT NULL,
                solana_pubkey TEXT UNIQUE,
                telegram_id TEXT UNIQUE,
                discord_id TEXT UNIQUE,
                twitter_id TEXT UNIQUE,
                ip TEXT
            );
        `);

        // Create RecommenderMetrics Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS recommender_metrics (
                recommender_id TEXT PRIMARY KEY,
                trust_score REAL DEFAULT 0,
                total_recommendations INTEGER DEFAULT 0,
                successful_recs INTEGER DEFAULT 0,
                avg_token_performance REAL DEFAULT 0,
                risk_score REAL DEFAULT 0,
                consistency_score REAL DEFAULT 0,
                virtual_confidence REAL DEFAULT 0,
                last_active_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                trust_decay REAL DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (recommender_id) REFERENCES recommenders(id) ON DELETE CASCADE
            );
        `);

        // Create TokenPerformance Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS token_performance (
                token_address TEXT PRIMARY KEY,
                symbol TEXT,
                price_change_24h REAL,
                volume_change_24h REAL,
                trade_24h_change REAL,
                liquidity REAL,
                liquidity_change_24h REAL,
                holder_change_24h REAL,
                rug_pull BOOLEAN DEFAULT FALSE,
                is_scam BOOLEAN DEFAULT FALSE,
                market_cap_change24h REAL,
                sustained_growth BOOLEAN DEFAULT FALSE,
                rapid_dump BOOLEAN DEFAULT FALSE,
                suspicious_volume BOOLEAN DEFAULT FALSE,
                validation_trust REAL DEFAULT 0,
                balance REAL DEFAULT 0,
                initial_market_cap REAL DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create TokenRecommendations Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS token_recommendations (
                id TEXT PRIMARY KEY,
                recommender_id TEXT NOT NULL,
                token_address TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                initial_market_cap REAL,
                initial_liquidity REAL,
                initial_price REAL,
                FOREIGN KEY (recommender_id) REFERENCES recommenders(id) ON DELETE CASCADE,
                FOREIGN KEY (token_address) REFERENCES token_performance(token_address) ON DELETE CASCADE
            );
        `);

        // ----- Create RecommenderMetricsHistory Table -----
        this.db.exec(`
         CREATE TABLE IF NOT EXISTS recommender_metrics_history (
             history_id TEXT PRIMARY KEY,
             recommender_id TEXT NOT NULL,
             trust_score REAL,
             total_recommendations INTEGER,
             successful_recs INTEGER,
             avg_token_performance REAL,
             risk_score REAL,
             consistency_score REAL,
             virtual_confidence REAL DEFAULT 0,
             recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (recommender_id) REFERENCES recommenders(id) ON DELETE CASCADE
         );
     `);

        // ----- Create TradePerformance Tables -----
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS trade (
            token_address TEXT NOT NULL,
            recommender_id TEXT NOT NULL,
            sell_recommender_id TEXT,
            buy_price REAL NOT NULL,
            sell_price REAL,
            buy_timeStamp TEXT NOT NULL,
            sell_timeStamp TEXT,
            buy_amount REAL NOT NULL,
            sell_amount REAL,
            buy_sol REAL NOT NULL,
            received_sol REAL,
            buy_value_usd REAL NOT NULL,
            sell_value_usd REAL,
            profit_usd REAL,
            profit_percent REAL,
            buy_market_cap REAL NOT NULL,
            sell_market_cap REAL,
            market_cap_change REAL,
            buy_liquidity REAL NOT NULL,
            sell_liquidity REAL,
            liquidity_change REAL,
            last_updated TEXT DEFAULT (datetime('now')),
            rapidDump BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (token_address, recommender_id, buy_timeStamp),
            FOREIGN KEY (token_address) REFERENCES token_performance(token_address) ON DELETE CASCADE,
            FOREIGN KEY (recommender_id) REFERENCES recommenders(id) ON DELETE CASCADE
        );
    `);
        // create trade simulation table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS simulation_trade (
          token_address TEXT NOT NULL,
          recommender_id TEXT NOT NULL,
          buy_price REAL NOT NULL,
          sell_price REAL,
          buy_timeStamp TEXT NOT NULL,
          sell_timeStamp TEXT,
          buy_amount REAL NOT NULL,
          sell_amount REAL,
          buy_sol REAL NOT NULL,
          received_sol REAL,
          buy_value_usd REAL NOT NULL,
          sell_value_usd REAL,
          profit_usd REAL,
          profit_percent REAL,
          buy_market_cap REAL NOT NULL,
          sell_market_cap REAL,
          market_cap_change REAL,
          buy_liquidity REAL NOT NULL,
          sell_liquidity REAL,
          liquidity_change REAL,
          last_updated TEXT DEFAULT (datetime('now')),
          rapidDump BOOLEAN DEFAULT FALSE,
          PRIMARY KEY (token_address, recommender_id, buy_timeStamp),
          FOREIGN KEY (token_address) REFERENCES token_performance(token_address) ON DELETE CASCADE,
          FOREIGN KEY (recommender_id) REFERENCES recommenders(id) ON DELETE CASCADE
      );
  `);

        // create transactions table
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            token_address TEXT NOT NULL,
            transaction_hash TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            price REAL NOT NULL,
            timestamp TEXT NOT NULL,
            is_simulation BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (token_address) REFERENCES token_performance(token_address) ON DELETE CASCADE
        );
    `);
    }

    /**
     * Adds a new recommender to the database.
     * @param recommender Recommender object
     * @returns boolean indicating success
     */
    addRecommender(recommender: Recommender): string | null {
        const sql = `
            INSERT INTO recommenders (id, address, solana_pubkey, telegram_id, discord_id, twitter_id, ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(address) DO NOTHING;
        `;
        try {
            const id = recommender.id || uuidv4();
            const result = this.db
                .prepare(sql)
                .run(
                    id,
                    recommender.address,
                    recommender.solanaPubkey || null,
                    recommender.telegramId || null,
                    recommender.discordId || null,
                    recommender.twitterId || null,
                    recommender.ip || null
                );
            return result.changes > 0 ? id : null;
        } catch (error) {
            console.error("Error adding recommender:", error);
            return null;
        }
    }

    /**
     * Retrieves a recommender by any identifier.
     * @param identifier Any of the recommender's identifiers
     * @returns Recommender object or null
     */
    getRecommender(identifier: string): Recommender | null {
        const sql = `
            SELECT * FROM recommenders
            WHERE id = ? OR address = ? OR solana_pubkey = ? OR telegram_id = ? OR discord_id = ? OR twitter_id = ?;
        `;
        const recommender = this.db
            .prepare(sql)
            .get(
                identifier,
                identifier,
                identifier,
                identifier,
                identifier,
                identifier
            ) as Recommender | undefined;
        return recommender || null;
    }

    /**
     * Retrieves an existing recommender or creates a new one if not found.
     * Also initializes metrics for the recommender if they haven't been initialized yet.
     * @param recommender Recommender object containing at least one identifier
     * @returns Recommender object with all details, or null if failed
     */
    getOrCreateRecommender(recommender: Recommender): Recommender | null {
        try {
            // Begin a transaction
            const transaction = this.db.transaction(() => {
                // Attempt to retrieve the recommender
                const existingRecommender = this.getRecommender(
                    recommender.address
                );
                if (existingRecommender) {
                    // Recommender exists, ensure metrics are initialized
                    this.initializeRecommenderMetrics(existingRecommender.id!);
                    return existingRecommender;
                }

                // Recommender does not exist, create a new one
                const newRecommenderId = this.addRecommender(recommender);
                if (!newRecommenderId) {
                    throw new Error("Failed to add new recommender.");
                }

                // Initialize metrics for the new recommender
                const metricsInitialized =
                    this.initializeRecommenderMetrics(newRecommenderId);
                if (!metricsInitialized) {
                    throw new Error(
                        "Failed to initialize recommender metrics."
                    );
                }

                // Retrieve and return the newly created recommender
                const newRecommender = this.getRecommender(newRecommenderId);
                if (!newRecommender) {
                    throw new Error(
                        "Failed to retrieve the newly created recommender."
                    );
                }

                return newRecommender;
            });

            // Execute the transaction and return the recommender
            const recommenderResult = transaction();
            return recommenderResult;
        } catch (error) {
            console.error("Error in getOrCreateRecommender:", error);
            return null;
        }
    }

    /**
     * Retrieves an existing recommender or creates a new one if not found.
     * Also initializes metrics for the recommender if they haven't been initialized yet.
     * @param discordId Discord ID of the recommender
     * @returns Recommender object with all details, or null if failed
     */

    async getOrCreateRecommenderWithDiscordId(
        discordId: string
    ): Promise<Recommender | null> {
        try {
            // Begin a transaction
            const transaction = this.db.transaction(() => {
                // Attempt to retrieve the recommender
                const existingRecommender = this.getRecommender(discordId);
                if (existingRecommender) {
                    // Recommender exists, ensure metrics are initialized
                    this.initializeRecommenderMetrics(existingRecommender.id!);
                    return existingRecommender;
                }

                // Recommender does not exist, create a new one
                const newRecommender = {
                    id: uuidv4(),
                    address: discordId,
                    discordId: discordId,
                };
                const newRecommenderId = this.addRecommender(newRecommender);
                if (!newRecommenderId) {
                    throw new Error("Failed to add new recommender.");
                }

                // Initialize metrics for the new recommender
                const metricsInitialized =
                    this.initializeRecommenderMetrics(newRecommenderId);
                if (!metricsInitialized) {
                    throw new Error(
                        "Failed to initialize recommender metrics."
                    );
                }

                // Retrieve and return the newly created recommender
                const recommender = this.getRecommender(newRecommenderId);
                if (!recommender) {
                    throw new Error(
                        "Failed to retrieve the newly created recommender."
                    );
                }

                return recommender;
            });

            // Execute the transaction and return the recommender
            const recommenderResult = transaction();
            return recommenderResult;
        } catch (error) {
            console.error(
                "Error in getOrCreateRecommenderWithDiscordId:",
                error
            );
            return null;
        }
    }

    /**
     * Retrieves an existing recommender or creates a new one if not found.
     * Also initializes metrics for the recommender if they haven't been initialized yet.
     * @param telegramId Telegram ID of the recommender
     * @returns Recommender object with all details, or null if failed
     */

    async getOrCreateRecommenderWithTelegramId(
        telegramId: string
    ): Promise<Recommender | null> {
        try {
            // Begin a transaction
            const transaction = this.db.transaction(() => {
                // Attempt to retrieve the recommender
                const existingRecommender = this.getRecommender(telegramId);
                if (existingRecommender) {
                    // Recommender exists, ensure metrics are initialized
                    this.initializeRecommenderMetrics(existingRecommender.id!);
                    return existingRecommender;
                }

                // Recommender does not exist, create a new one
                const newRecommender = {
                    id: uuidv4(),
                    address: telegramId,
                    telegramId: telegramId,
                };
                const newRecommenderId = this.addRecommender(newRecommender);
                if (!newRecommenderId) {
                    throw new Error("Failed to add new recommender.");
                }

                // Initialize metrics for the new recommender
                const metricsInitialized =
                    this.initializeRecommenderMetrics(newRecommenderId);
                if (!metricsInitialized) {
                    throw new Error(
                        "Failed to initialize recommender metrics."
                    );
                }

                // Retrieve and return the newly created recommender
                const recommender = this.getRecommender(newRecommenderId);
                if (!recommender) {
                    throw new Error(
                        "Failed to retrieve the newly created recommender."
                    );
                }

                return recommender;
            });

            // Execute the transaction and return the recommender
            const recommenderResult = transaction();
            return recommenderResult;
        } catch (error) {
            console.error(
                "Error in getOrCreateRecommenderWithTelegramId:",
                error
            );
            return null;
        }
    }

    /**
     * Initializes metrics for a recommender if not present.
     * @param recommenderId Recommender's UUID
     */
    initializeRecommenderMetrics(recommenderId: string): boolean {
        const sql = `
            INSERT OR IGNORE INTO recommender_metrics (recommender_id)
            VALUES (?);
        `;
        try {
            const result = this.db.prepare(sql).run(recommenderId);
            return result.changes > 0;
        } catch (error) {
            console.error("Error initializing recommender metrics:", error);
            return false;
        }
    }

    /**
     * Retrieves metrics for a recommender.
     * @param recommenderId Recommender's UUID
     * @returns RecommenderMetrics object or null
     */
    getRecommenderMetrics(recommenderId: string): RecommenderMetrics | null {
        const sql = `SELECT * FROM recommender_metrics WHERE recommender_id = ?;`;
        const row = this.db.prepare(sql).get(recommenderId) as
            | RecommenderMetricsRow
            | undefined;
        if (!row) return null;

        return {
            recommenderId: row.recommender_id,
            trustScore: row.trust_score,
            totalRecommendations: row.total_recommendations,
            successfulRecs: row.successful_recs,
            avgTokenPerformance: row.avg_token_performance,
            riskScore: row.risk_score,
            consistencyScore: row.consistency_score,
            virtualConfidence: row.virtual_confidence,
            lastActiveDate: row.last_active_date,
            trustDecay: row.trust_decay,
            lastUpdated: new Date(row.last_updated),
        };
    }

    /**
     * Logs the current metrics of a recommender into the history table.
     * @param recommenderId Recommender's UUID
     */
    logRecommenderMetricsHistory(recommenderId: string): void {
        // Retrieve current metrics
        const currentMetrics = this.getRecommenderMetrics(recommenderId);
        if (!currentMetrics) {
            console.warn(
                `No metrics found for recommender ID: ${recommenderId}`
            );
            return;
        }

        // Create a history entry
        const history: RecommenderMetricsHistory = {
            historyId: uuidv4(),
            recommenderId: currentMetrics.recommenderId,
            trustScore: currentMetrics.trustScore,
            totalRecommendations: currentMetrics.totalRecommendations,
            successfulRecs: currentMetrics.successfulRecs,
            avgTokenPerformance: currentMetrics.avgTokenPerformance,
            riskScore: currentMetrics.riskScore,
            consistencyScore: currentMetrics.consistencyScore,
            virtualConfidence: currentMetrics.virtualConfidence,
            trustDecay: currentMetrics.trustDecay,
            recordedAt: new Date(), // Current timestamp
        };

        // Insert into recommender_metrics_history table
        const sql = `
            INSERT INTO recommender_metrics_history (
                history_id,
                recommender_id,
                trust_score,
                total_recommendations,
                successful_recs,
                avg_token_performance,
                risk_score,
                consistency_score,
                recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        try {
            this.db
                .prepare(sql)
                .run(
                    history.historyId,
                    history.recommenderId,
                    history.trustScore,
                    history.totalRecommendations,
                    history.successfulRecs,
                    history.avgTokenPerformance,
                    history.riskScore,
                    history.consistencyScore,
                    history.recordedAt.toISOString()
                );
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
    updateRecommenderMetrics(metrics: RecommenderMetrics): void {
        // Log current metrics before updating
        this.logRecommenderMetricsHistory(metrics.recommenderId);

        const sql = `
            UPDATE recommender_metrics
            SET trust_score = ?,
                total_recommendations = ?,
                successful_recs = ?,
                avg_token_performance = ?,
                risk_score = ?,
                consistency_score = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE recommender_id = ?;
        `;
        try {
            this.db
                .prepare(sql)
                .run(
                    metrics.trustScore,
                    metrics.totalRecommendations,
                    metrics.successfulRecs,
                    metrics.avgTokenPerformance,
                    metrics.riskScore,
                    metrics.consistencyScore,
                    metrics.recommenderId
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
    upsertTokenPerformance(performance: TokenPerformance): boolean {
        const validationTrust = this.calculateValidationTrust(
            performance.tokenAddress
        );

        const sql = `
            INSERT INTO token_performance (
                token_address,
                price_change_24h,
                volume_change_24h,
                trade_24h_change,
                liquidity,
                liquidity_change_24h,
                holder_change_24h,
                rug_pull,
                is_scam,
                market_cap_change24h,
                sustained_growth,
                rapid_dump,
                suspicious_volume,
                validation_trust,
                balance,
                initial_market_cap,
                last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(token_address) DO UPDATE SET
                price_change_24h = excluded.price_change_24h,
                volume_change_24h = excluded.volume_change_24h,
                trade_24h_change = excluded.trade_24h_change,
                liquidity = excluded.liquidity,
                liquidity_change_24h = excluded.liquidity_change_24h,
                holder_change_24h = excluded.holder_change_24h,
                rug_pull = excluded.rug_pull,
                is_scam = excluded.is_scam,
                market_cap_change24h = excluded.market_cap_change24h,
                sustained_growth = excluded.sustained_growth,
                rapid_dump = excluded.rapid_dump,
                suspicious_volume = excluded.suspicious_volume,
                validation_trust = excluded.validation_trust,
                balance = excluded.balance,
                initial_market_cap = excluded.initial_market_cap,
                last_updated = CURRENT_TIMESTAMP;
        `;
        try {
            this.db.prepare(sql).run(
                performance.tokenAddress,
                performance.priceChange24h,
                performance.volumeChange24h,
                performance.trade_24h_change,
                performance.liquidity,
                performance.liquidityChange24h,
                performance.holderChange24h, // Ensure column name matches schema
                performance.rugPull ? 1 : 0,
                performance.isScam ? 1 : 0,
                performance.marketCapChange24h,
                performance.sustainedGrowth ? 1 : 0,
                performance.rapidDump ? 1 : 0,
                performance.suspiciousVolume ? 1 : 0,
                performance.balance,
                performance.initialMarketCap,
                validationTrust
            );
            console.log(
                `Upserted token performance for ${performance.tokenAddress}`
            );
            return true;
        } catch (error) {
            console.error("Error upserting token performance:", error);
            return false;
        }
    }

    // update token balance

    updateTokenBalance(tokenAddress: string, balance: number): boolean {
        const sql = `
            UPDATE token_performance
            SET balance = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE token_address = ?;
        `;
        try {
            this.db.prepare(sql).run(balance, tokenAddress);
            console.log(`Updated token balance for ${tokenAddress}`);
            return true;
        } catch (error) {
            console.error("Error updating token balance:", error);
            return false;
        }
    }

    /**
     * Retrieves token performance metrics.
     * @param tokenAddress Token's address
     * @returns TokenPerformance object or null
     */
    getTokenPerformance(tokenAddress: string): TokenPerformance | null {
        const sql = `SELECT * FROM token_performance WHERE token_address = ?;`;
        const row = this.db.prepare(sql).get(tokenAddress) as
            | TokenPerformanceRow
            | undefined;
        if (!row) return null;

        return {
            tokenAddress: row.token_address,
            symbol: row.symbol,
            priceChange24h: row.price_change_24h,
            volumeChange24h: row.volume_change_24h,
            trade_24h_change: row.trade_24h_change,
            liquidity: row.liquidity,
            liquidityChange24h: row.liquidity_change_24h,
            holderChange24h: row.holder_change_24h,
            rugPull: row.rug_pull === 1,
            isScam: row.is_scam === 1,
            marketCapChange24h: row.market_cap_change24h,
            sustainedGrowth: row.sustained_growth === 1,
            rapidDump: row.rapid_dump === 1,
            suspiciousVolume: row.suspicious_volume === 1,
            validationTrust: row.validation_trust,
            balance: row.balance,
            initialMarketCap: row.initial_market_cap,
            lastUpdated: new Date(row.last_updated),
        };
    }

    //getTokenBalance
    getTokenBalance(tokenAddress: string): number {
        const sql = `SELECT balance FROM token_performance WHERE token_address = ?;`;
        const row = this.db.prepare(sql).get(tokenAddress) as {
            balance: number;
        };
        return row.balance;
    }

    getAllTokenPerformancesWithBalance(): TokenPerformance[] {
        const sql = `SELECT * FROM token_performance WHERE balance > 0;`;
        const rows = this.db.prepare(sql).all() as TokenPerformanceRow[];

        return rows.map((row) => ({
            tokenAddress: row.token_address,
            symbol: row.symbol,
            priceChange24h: row.price_change_24h,
            volumeChange24h: row.volume_change_24h,
            trade_24h_change: row.trade_24h_change,
            liquidity: row.liquidity,
            liquidityChange24h: row.liquidity_change_24h,
            holderChange24h: row.holder_change_24h,
            rugPull: row.rug_pull === 1,
            isScam: row.is_scam === 1,
            marketCapChange24h: row.market_cap_change24h,
            sustainedGrowth: row.sustained_growth === 1,
            rapidDump: row.rapid_dump === 1,
            suspiciousVolume: row.suspicious_volume === 1,
            validationTrust: row.validation_trust,
            balance: row.balance,
            initialMarketCap: row.initial_market_cap,
            lastUpdated: new Date(row.last_updated),
        }));
    }

    // ----- TokenRecommendations Methods -----

    /**
     * Calculates the average trust score of all recommenders who have recommended a specific token.
     * @param tokenAddress The address of the token.
     * @returns The average trust score (validationTrust).
     */
    calculateValidationTrust(tokenAddress: string): number {
        const sql = `
        SELECT rm.trust_score
        FROM token_recommendations tr
        JOIN recommender_metrics rm ON tr.recommender_id = rm.recommender_id
        WHERE tr.token_address = ?;
    `;
        const rows = this.db.prepare(sql).all(tokenAddress) as Array<{
            trust_score: number;
        }>;

        if (rows.length === 0) return 0; // No recommendations found

        const totalTrust = rows.reduce((acc, row) => acc + row.trust_score, 0);
        const averageTrust = totalTrust / rows.length;
        return averageTrust;
    }

    /**
     * Adds a new token recommendation.
     * @param recommendation TokenRecommendation object
     * @returns boolean indicating success
     */
    addTokenRecommendation(recommendation: TokenRecommendation): boolean {
        const sql = `
            INSERT INTO token_recommendations (
                id,
                recommender_id,
                token_address,
                timestamp,
                initial_market_cap,
                initial_liquidity,
                initial_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
        `;
        try {
            this.db
                .prepare(sql)
                .run(
                    recommendation.id || uuidv4(),
                    recommendation.recommenderId,
                    recommendation.tokenAddress,
                    recommendation.timestamp || new Date(),
                    recommendation.initialMarketCap || null,
                    recommendation.initialLiquidity || null,
                    recommendation.initialPrice || null
                );
            return true;
        } catch (error) {
            console.error("Error adding token recommendation:", error);
            return false;
        }
    }

    /**
     * Retrieves all recommendations made by a recommender.
     * @param recommenderId Recommender's UUID
     * @returns Array of TokenRecommendation objects
     */
    getRecommendationsByRecommender(
        recommenderId: string
    ): TokenRecommendation[] {
        const sql = `SELECT * FROM token_recommendations WHERE recommender_id = ? ORDER BY timestamp DESC;`;
        const rows = this.db.prepare(sql).all(recommenderId) as Array<{
            id: string;
            recommender_id: string;
            token_address: string;
            timestamp: string;
            initial_market_cap: number | null;
            initial_liquidity: number | null;
            initial_price: number | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            recommenderId: row.recommender_id,
            tokenAddress: row.token_address,
            timestamp: new Date(row.timestamp),
            initialMarketCap: row.initial_market_cap,
            initialLiquidity: row.initial_liquidity,
            initialPrice: row.initial_price,
        }));
    }

    /**
     * Retrieves all recommendations for a specific token.
     * @param tokenAddress Token's address
     * @returns Array of TokenRecommendation objects
     */
    getRecommendationsByToken(tokenAddress: string): TokenRecommendation[] {
        const sql = `SELECT * FROM token_recommendations WHERE token_address = ? ORDER BY timestamp DESC;`;
        const rows = this.db.prepare(sql).all(tokenAddress) as Array<{
            id: string;
            recommender_id: string;
            token_address: string;
            timestamp: string;
            initial_market_cap: number | null;
            initial_liquidity: number | null;
            initial_price: number | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            recommenderId: row.recommender_id,
            tokenAddress: row.token_address,
            timestamp: new Date(row.timestamp),
            initialMarketCap: row.initial_market_cap ?? undefined,
            initialLiquidity: row.initial_liquidity ?? undefined,
            initialPrice: row.initial_price ?? undefined,
        }));
    }

    /**
     * Retrieves all recommendations within a specific timeframe.
     * @param startDate Start date
     * @param endDate End date
     * @returns Array of TokenRecommendation objects
     */
    getRecommendationsByDateRange(
        startDate: Date,
        endDate: Date
    ): TokenRecommendation[] {
        const sql = `
            SELECT * FROM token_recommendations
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp DESC;
        `;
        const rows = this.db
            .prepare(sql)
            .all(startDate.toISOString(), endDate.toISOString()) as Array<{
            id: string;
            recommender_id: string;
            token_address: string;
            timestamp: string;
            initial_market_cap: number | null;
            initial_liquidity: number | null;
            initial_price: number | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            recommenderId: row.recommender_id,
            tokenAddress: row.token_address,
            timestamp: new Date(row.timestamp),
            initialMarketCap: row.initial_market_cap ?? undefined,
            initialLiquidity: row.initial_liquidity ?? undefined,
            initialPrice: row.initial_price ?? undefined,
        }));
    }

    /**
     * Retrieves historical metrics for a recommender.
     * @param recommenderId Recommender's UUID
     * @returns Array of RecommenderMetricsHistory objects
     */
    getRecommenderMetricsHistory(
        recommenderId: string
    ): RecommenderMetricsHistory[] {
        const sql = `
          SELECT * FROM recommender_metrics_history
          WHERE recommender_id = ?
          ORDER BY recorded_at DESC;
      `;
        const rows = this.db.prepare(sql).all(recommenderId) as Array<{
            history_id: string;
            recommender_id: string;
            trust_score: number;
            total_recommendations: number;
            successful_recs: number;
            avg_token_performance: number;
            risk_score: number;
            consistency_score: number;
            virtual_confidence: number;
            trust_decay: number;
            recorded_at: string;
        }>;

        return rows.map((row) => ({
            historyId: row.history_id,
            recommenderId: row.recommender_id,
            trustScore: row.trust_score,
            totalRecommendations: row.total_recommendations,
            successfulRecs: row.successful_recs,
            avgTokenPerformance: row.avg_token_performance,
            riskScore: row.risk_score,
            consistencyScore: row.consistency_score,
            virtualConfidence: row.virtual_confidence,
            trustDecay: row.trust_decay,
            recordedAt: new Date(row.recorded_at),
        }));
    }

    /**
     * Inserts a new trade performance into the specified table.
     * @param trade The TradePerformance object containing trade details.
     * @param isSimulation Whether the trade is a simulation. If true, inserts into simulation_trade; otherwise, into trade.
     * @returns boolean indicating success.
     */
    addTradePerformance(
        trade: TradePerformance,
        isSimulation: boolean
    ): boolean {
        const tableName = isSimulation ? "simulation_trade" : "trade";
        const sql = `
      INSERT INTO ${tableName} (
          token_address,
          recommender_id,
          buy_price,
          sell_price,
          buy_timeStamp,
          sell_timeStamp,
          buy_amount,
          sell_amount,
          buy_sol,
          received_sol,
          buy_value_usd,
          sell_value_usd,
          profit_usd,
          profit_percent,
          buy_market_cap,
          sell_market_cap,
          market_cap_change,
          buy_liquidity,
          sell_liquidity,
          liquidity_change,
          last_updated,
          rapidDump
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
        try {
            this.db
                .prepare(sql)
                .run(
                    trade.token_address,
                    trade.recommender_id,
                    trade.buy_price,
                    trade.sell_price || null,
                    trade.buy_timeStamp,
                    trade.sell_timeStamp || null,
                    trade.buy_amount,
                    trade.sell_amount || null,
                    trade.buy_sol,
                    trade.received_sol || null,
                    trade.buy_value_usd,
                    trade.sell_value_usd || null,
                    trade.profit_usd || null,
                    trade.profit_percent || null,
                    trade.buy_market_cap,
                    trade.sell_market_cap || null,
                    trade.market_cap_change || null,
                    trade.buy_liquidity,
                    trade.sell_liquidity || null,
                    trade.liquidity_change || null,
                    trade.last_updated || new Date().toISOString(),
                    trade.rapidDump ? 1 : 0
                );
            console.log(`Inserted trade into ${tableName}:`, trade);
            return true;
        } catch (error) {
            console.error(`Error inserting trade into ${tableName}:`, error);
            return false;
        }
    }

    /**
     * Updates an existing trade with sell details.
     * @param tokenAddress The address of the token.
     * @param recommenderId The UUID of the recommender.
     * @param buyTimeStamp The timestamp when the buy occurred.
     * @param sellDetails An object containing sell-related details.
     * @param isSimulation Whether the trade is a simulation. If true, updates in simulation_trade; otherwise, in trade.
     * @returns boolean indicating success.
     */

    updateTradePerformanceOnSell(
        tokenAddress: string,
        recommenderId: string,
        buyTimeStamp: string,
        sellDetails: {
            sell_price: number;
            sell_timeStamp: string;
            sell_amount: number;
            received_sol: number;
            sell_value_usd: number;
            profit_usd: number;
            profit_percent: number;
            sell_market_cap: number;
            market_cap_change: number;
            sell_liquidity: number;
            liquidity_change: number;
            rapidDump: boolean;
            sell_recommender_id: string | null;
        },
        isSimulation: boolean
    ): boolean {
        const tableName = isSimulation ? "simulation_trade" : "trade";
        const sql = `
        UPDATE ${tableName}
        SET
            sell_price = ?,
            sell_timeStamp = ?,
            sell_amount = ?,
            received_sol = ?,
            sell_value_usd = ?,
            profit_usd = ?,
            profit_percent = ?,
            sell_market_cap = ?,
            market_cap_change = ?,
            sell_liquidity = ?,
            liquidity_change = ?,
            rapidDump = ?,
            sell_recommender_id = ?
        WHERE
            token_address = ? AND
            recommender_id = ? AND
            buy_timeStamp = ?;
    `;
        try {
            const result = this.db.prepare(sql).run(
                sellDetails.sell_price,
                sellDetails.sell_timeStamp,
                sellDetails.sell_amount,
                sellDetails.received_sol,
                sellDetails.sell_value_usd,
                sellDetails.profit_usd,
                sellDetails.profit_percent,
                sellDetails.sell_market_cap,
                sellDetails.market_cap_change,
                sellDetails.sell_liquidity,
                sellDetails.liquidity_change,
                sellDetails.rapidDump ? 1 : 0,
                sellDetails.sell_recommender_id,
                tokenAddress,
                recommenderId,
                buyTimeStamp
            );

            if (result.changes === 0) {
                console.warn(
                    `No trade found to update in ${tableName} for token: ${tokenAddress}, recommender: ${recommenderId}, buyTimeStamp: ${buyTimeStamp}`
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error(`Error updating trade in ${tableName}:`, error);
            return false;
        }
    }

    //getTradePerformance

    /**
     * Retrieves trade performance metrics.
     * @param tokenAddress Token's address
     * @param recommenderId Recommender's UUID
     * @param buyTimeStamp Timestamp when the buy occurred
     * @param isSimulation Whether the trade is a simulation. If true, retrieves from simulation_trade; otherwise, from trade.
     * @returns TradePerformance object or null
     */

    getTradePerformance(
        tokenAddress: string,
        recommenderId: string,
        buyTimeStamp: string,
        isSimulation: boolean
    ): TradePerformance | null {
        const tableName = isSimulation ? "simulation_trade" : "trade";
        const sql = `SELECT * FROM ${tableName} WHERE token_address = ? AND recommender_id = ? AND buy_timeStamp = ?;`;
        const row = this.db
            .prepare(sql)
            .get(tokenAddress, recommenderId, buyTimeStamp) as
            | TradePerformance
            | undefined;
        if (!row) return null;

        return {
            token_address: row.token_address,
            recommender_id: row.recommender_id,
            buy_price: row.buy_price,
            sell_price: row.sell_price,
            buy_timeStamp: row.buy_timeStamp,
            sell_timeStamp: row.sell_timeStamp,
            buy_amount: row.buy_amount,
            sell_amount: row.sell_amount,
            buy_sol: row.buy_sol,
            received_sol: row.received_sol,
            buy_value_usd: row.buy_value_usd,
            sell_value_usd: row.sell_value_usd,
            profit_usd: row.profit_usd,
            profit_percent: row.profit_percent,
            buy_market_cap: row.buy_market_cap,
            sell_market_cap: row.sell_market_cap,
            market_cap_change: row.market_cap_change,
            buy_liquidity: row.buy_liquidity,
            sell_liquidity: row.sell_liquidity,
            liquidity_change: row.liquidity_change,
            last_updated: row.last_updated,
            rapidDump: row.rapidDump,
        };
    }

    /**
     * Retrieves the latest trade performance metrics without requiring buyTimeStamp.
     * @param tokenAddress Token's address
     * @param recommenderId Recommender's UUID
     * @param isSimulation Whether the trade is a simulation. If true, retrieves from simulation_trade; otherwise, from trade.
     * @returns TradePerformance object or null
     */
    getLatestTradePerformance(
        tokenAddress: string,
        recommenderId: string,
        isSimulation: boolean
    ): TradePerformance | null {
        const tableName = isSimulation ? "simulation_trade" : "trade";
        const sql = `
        SELECT * FROM ${tableName}
        WHERE token_address = ? AND recommender_id = ?
        ORDER BY buy_timeStamp DESC
        LIMIT 1;
    `;
        const row = this.db.prepare(sql).get(tokenAddress, recommenderId) as
            | TradePerformance
            | undefined;
        if (!row) return null;

        return {
            token_address: row.token_address,
            recommender_id: row.recommender_id,
            buy_price: row.buy_price,
            sell_price: row.sell_price,
            buy_timeStamp: row.buy_timeStamp,
            sell_timeStamp: row.sell_timeStamp,
            buy_amount: row.buy_amount,
            sell_amount: row.sell_amount,
            buy_sol: row.buy_sol,
            received_sol: row.received_sol,
            buy_value_usd: row.buy_value_usd,
            sell_value_usd: row.sell_value_usd,
            profit_usd: row.profit_usd,
            profit_percent: row.profit_percent,
            buy_market_cap: row.buy_market_cap,
            sell_market_cap: row.sell_market_cap,
            market_cap_change: row.market_cap_change,
            buy_liquidity: row.buy_liquidity,
            sell_liquidity: row.sell_liquidity,
            liquidity_change: row.liquidity_change,
            last_updated: row.last_updated,
            rapidDump: row.rapidDump,
        };
    }

    // ----- Transactions Methods -----
    /**
     * Adds a new transaction to the database.
     * @param transaction Transaction object
     * @returns boolean indicating success
     */

    addTransaction(transaction: Transaction): boolean {
        const sql = `
        INSERT INTO transactions (
            token_address,
            transaction_hash,
            type,
            amount,
            price,
            is_simulation,
            timestamp
        ) VALUES (?, ?, ?, ?, ?, ?);
    `;
        try {
            this.db
                .prepare(sql)
                .run(
                    transaction.tokenAddress,
                    transaction.transactionHash,
                    transaction.type,
                    transaction.amount,
                    transaction.price,
                    transaction.isSimulation,
                    transaction.timestamp
                );
            return true;
        } catch (error) {
            console.error("Error adding transaction:", error);
            return false;
        }
    }

    /**
     * Retrieves all transactions for a specific token.
     * @param tokenAddress Token's address
     * @returns Array of Transaction objects
     */
    getTransactionsByToken(tokenAddress: string): Transaction[] {
        const sql = `SELECT * FROM transactions WHERE token_address = ? ORDER BY timestamp DESC;`;
        const rows = this.db.prepare(sql).all(tokenAddress) as Array<{
            token_address: string;
            transaction_hash: string;
            type: string;
            amount: number;
            price: number;
            is_simulation: boolean;
            timestamp: string;
        }>;

        return rows.map((row) => {
            // Validate and cast 'type' to ensure it matches the expected union type
            if (row.type !== "buy" && row.type !== "sell") {
                throw new Error(`Unexpected transaction type: ${row.type}`);
            }

            return {
                tokenAddress: row.token_address,
                transactionHash: row.transaction_hash,
                type: row.type as "buy" | "sell",
                amount: row.amount,
                price: row.price,
                isSimulation: row.is_simulation,
                timestamp: new Date(row.timestamp).toISOString(),
            };
        });
    }
        /**
     * Executes a custom query on the trade table with parameters.
     * @param query SQL query string
     * @param params Query parameters
     * @returns Array of TradePerformance objects
     */
        getTradesByQuery(query: string, params: any[]): TradePerformance[] {
            try {
                const rows = this.db.prepare(query).all(params) as any[];

                return rows.map(row => ({
                    token_address: row.token_address,
                    recommender_id: row.recommender_id,
                    buy_price: row.buy_price,
                    sell_price: row.sell_price,
                    buy_timeStamp: row.buy_timeStamp,
                    sell_timeStamp: row.sell_timeStamp,
                    buy_amount: row.buy_amount,
                    sell_amount: row.sell_amount,
                    buy_sol: row.buy_sol,
                    received_sol: row.received_sol,
                    buy_value_usd: row.buy_value_usd,
                    sell_value_usd: row.sell_value_usd,
                    profit_usd: row.profit_usd,
                    profit_percent: row.profit_percent,
                    buy_market_cap: row.buy_market_cap,
                    sell_market_cap: row.sell_market_cap,
                    market_cap_change: row.market_cap_change,
                    buy_liquidity: row.buy_liquidity,
                    sell_liquidity: row.sell_liquidity,
                    liquidity_change: row.liquidity_change,
                    last_updated: row.last_updated,
                    rapidDump: row.rapidDump === 1
                }));
            } catch (error) {
                console.error("Error executing trade query:", error);
                return [];
            }
    }

    /**
     * Close the database connection gracefully.
     */
    closeConnection(): void {
        this.db.close();
    }

    /**
     * Retrieves trade history for a specific token and recommender.
     * @param tokenAddress Token's address
     * @param recommenderId Recommender's UUID
     * @param isSimulation Whether the trade is a simulation. If true, retrieves from simulation_trade; otherwise, from trade.
     * @returns Array of TradePerformance objects
     */
    async getTradeHistory(
        tokenAddress: string,
        recommenderId: string,
        isSimulation: boolean
    ): Promise<TradePerformance[]> {
        const tableName = isSimulation ? "simulation_trade" : "trade";
        const sql = `
            SELECT * FROM ${tableName}
            WHERE token_address = ? AND recommender_id = ?
            ORDER BY buy_timeStamp DESC;
        `;

        try {
            const rows = this.db.prepare(sql).all(tokenAddress, recommenderId) as any[];

            return rows.map(row => ({
                token_address: row.token_address,
                recommender_id: row.recommender_id,
                buy_price: row.buy_price,
                sell_price: row.sell_price,
                buy_timeStamp: row.buy_timeStamp,
                sell_timeStamp: row.sell_timeStamp,
                buy_amount: row.buy_amount,
                sell_amount: row.sell_amount,
                buy_sol: row.buy_sol,
                received_sol: row.received_sol,
                buy_value_usd: row.buy_value_usd,
                sell_value_usd: row.sell_value_usd,
                profit_usd: row.profit_usd,
                profit_percent: row.profit_percent,
                buy_market_cap: row.buy_market_cap,
                sell_market_cap: row.sell_market_cap,
                market_cap_change: row.market_cap_change,
                buy_liquidity: row.buy_liquidity,
                sell_liquidity: row.sell_liquidity,
                liquidity_change: row.liquidity_change,
                last_updated: row.last_updated,
                rapidDump: Boolean(row.rapidDump)
            }));
        } catch (error) {
            console.error("Error getting trade history:", error);
            return [];
        }
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


// Drizzle ORM version

// export class TrustScoreDatabase {
//     constructor(private db: DB) {
//         this.db = db;

//         // load(db);
//         // check if the tables exist, if not create them
//         const requiredTables = [];

//         //    const existingTables = this.db
//         //        .prepare(
//         //            `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => "?").join(",")});`
//         //        )
//         //        .all(...requiredTables);

//         //  if (existingTables.length !== requiredTables.length) {
//         //      this.initializeSchema();
//         //  }
//     }

//     async transaction<T>(
//         callback: (
//             tx: PgTransaction<
//                 NodePgQueryResultHKT,
//                 typeof schema,
//                 ExtractTablesWithRelations<typeof schema>
//             >
//         ) => Promise<T>
//     ): Promise<T> {
//         return this.db.transaction(callback);
//     }

//     /**
//      * Adds a new recommender to the database.
//      * @param recommender Recommender object
//      * @returns boolean indicating success
//      */
//     private async addRecommender(
//         recommender: Recommender
//     ): Promise<UUID | null> {
//         try {
//             // First try to find existing recommender
//             const existing = await this.getRecommenderByPlatform(
//                 recommender.platform,
//                 recommender.userId
//             );
//             if (existing) return existing.id;

//             // First ensure the account exists
//             await this.db
//                 .insert(schema.accounts)
//                 .values({
//                     id: recommender.userId,
//                     username: recommender.username,
//                     email: `${recommender.userId}@${recommender.platform}.com`,
//                     avatarUrl: "",
//                     details: {},
//                 })
//                 .onConflictDoNothing();

//             // Then insert the recommender
//             const result = await this.db
//                 .insert(schema.recommenders)
//                 .values({
//                     id: recommender.id,
//                     platform: recommender.platform,
//                     userId: recommender.userId,
//                     username: recommender.username,
//                 })
//                 .returning();

//             return result[0]?.id as UUID | null;
//         } catch (error) {
//             console.error("Error adding recommender:", error);
//             return null;
//         }
//     }

//     /**
//      * Retrieves a recommender by user ID.
//      * @param userId User's ID
//      * @returns Recommender object or null
//      */

//     async getRecommenderByUserId(userId: string): Promise<Recommender | null> {
//         const recommender = await this.db
//             .select()
//             .from(schema.recommenders)
//             .where(eq(schema.recommenders.userId, userId))
//             .limit(1);

//         return recommender[0] as Recommender | null;
//     }

//     /**
//      * Retrieves a recommender by any identifier.
//      * @param identifier Any of the recommender's identifiers
//      * @returns Recommender object or null
//      */
//     async getRecommender(id: UUID): Promise<Recommender | null> {
//         const recommender = await this.db
//             .select()
//             .from(schema.recommenders)
//             .where(eq(schema.recommenders.id, id))
//             .limit(1);

//         return recommender[0] as Recommender | null;
//     }
//     /**
//      * Retrieves a recommender by any identifier.
//      * @param identifier Any of the recommender's identifiers
//      * @returns Recommender object or null
//      */
//     async getRecommenderByPlatform(
//         platform: string,
//         userId: string
//     ): Promise<Recommender | null> {
//         const recommender = await this.db
//             .select()
//             .from(schema.recommenders)
//             .where(
//                 and(
//                     eq(schema.recommenders.platform, platform),
//                     eq(schema.recommenders.userId, userId)
//                 )
//             )
//             .limit(1);

//         return recommender[0] as Recommender | null;
//     }

//     private async createAndInitializeRecommender(
//         recommender: Recommender
//     ): Promise<Recommender> {
//         const newRecommenderId = await this.addRecommender(recommender);
//         if (!newRecommenderId) throw new Error("Failed to add new recommender");

//         await this.initializeRecommenderMetrics(newRecommenderId);

//         // Retrieve and return the newly created recommender
//         const newRecommender = await this.getRecommender(newRecommenderId);
//         return newRecommender!;
//     }

//     /**
//      * Retrieves an existing recommender or creates a new one if not found.
//      * Also initializes metrics for the recommender if they haven't been initialized yet.
//      * @param recommender Recommender object containing at least one identifier
//      * @returns Recommender object with all details, or null if failed
//      */
//     async getOrCreateRecommender(
//         recommender: Optional<Recommender, "id">
//     ): Promise<Recommender> {
//         await this.getAccountByPlatformIdOrUserId(
//             recommender.platform,
//             recommender.userId,
//             recommender.clientId,
//             recommender.username
//         );

//         const existingRecommender = recommender.id
//             ? await this.getRecommender(recommender.id)
//             : await this.getRecommenderByUserId(recommender.userId);

//         if (existingRecommender) {
//             return existingRecommender;
//         }

//         return this.createAndInitializeRecommender({
//             ...recommender,
//             id: recommender.id ?? (uuidv4() as UUID),
//         });
//     }

//     /**
//      * Retrieves an account by platform-specific ID or username.
//      * If an account with the username exists but has no platform-specific ID or clientId, it will be linked.
//      */
//     private async getAccountByPlatformIdOrUserId(
//         platform: string,
//         userId: string,
//         clientId: string | undefined,
//         username: string
//     ): Promise<Account | null> {
//         // Step 1: Try to find the account by platform-specific ID
//         const account = await this.getAccountByPlatformIdOrUsername(
//             platform,
//             userId,
//             username
//         );
//         if (account) {
//             // Check if the account has no platform-specific ID or clientId
//             const platformIdField =
//                 platform === "telegram"
//                     ? "telegramId"
//                     : platform === "discord"
//                       ? "discordId"
//                       : null;
//             if (platformIdField && !account[platformIdField]) {
//                 try {
//                     // Update the account with the platform-specific ID and clientId
//                     await this.updateAccountPlatformIdAndClientId(
//                         account.id,
//                         platform,
//                         clientId
//                     );
//                 } catch (error) {
//                     console.error(
//                         `Failed to update account ${account.id} with platform ID:`,
//                         error
//                     );
//                 }
//                 return account;
//             }
//         }

//         // Step 3: If no account is found, return null
//         return null;
//     }

//     /**
//      * Updates the platform-specific ID and clientId for an account.
//      */
//     private async updateAccountPlatformIdAndClientId(
//         accountId: UUID,
//         platform: string,
//         clientId: string | undefined
//     ): Promise<void> {
//         if (!clientId) {
//             throw new Error(
//                 "clientId is required to update the platform-specific ID"
//             );
//         }

//         const updateData: Partial<Account> = {
//             [platform === "telegram" ? "telegramId" : "discordId"]: clientId,
//         };

//         try {
//             await this.db
//                 .update(schema.accounts)
//                 .set(updateData)
//                 .where(eq(schema.accounts.id, accountId));
//         } catch (error) {
//             console.error(
//                 `Failed to update account ${accountId} with platform ID:`,
//                 error
//             );
//             throw error;
//         }
//     }

//     /**
//      * Retrieves an account by its platform-specific ID (e.g., telegramId, discordId).
//      * Or by username if the platform-specific ID is not available.
//      */

//     private async getAccountByPlatformIdOrUsername(
//         platform: string,
//         userId: string,
//         username: string
//     ): Promise<Account | null> {
//         const platformIdField =
//             platform === "telegram" ? "telegramId" : "discordId";

//         const result = await this.db
//             .select()
//             .from(schema.accounts)
//             .where(
//                 or(
//                     eq(schema.accounts[platformIdField], userId),
//                     eq(schema.accounts.username, username)
//                 )
//             )
//             .limit(1);

//         return result[0] as unknown as Account | null;
//     }

//     /**
//      * Initializes metrics for a recommender if not present.
//      * @param recommenderId Recommender's UUID
//      */
//     async initializeRecommenderMetrics(
//         recommenderId: string
//     ): Promise<boolean> {
//         try {
//             const result = await this.db
//                 .insert(schema.recommenderMetrics)
//                 .values({
//                     recommenderId: recommenderId,
//                 })
//                 .onConflictDoNothing()
//                 .returning();

//             return result.length > 0;
//         } catch (error) {
//             console.error("Error initializing recommender metrics:", error);
//             return false;
//         }
//     }

//     async getRecommenderMetrics(
//         recommenderId: string
//     ): Promise<RecommenderMetrics | undefined> {
//         const recommenderMetrics = await this.db
//             .select()
//             .from(schema.recommenderMetrics)
//             .where(eq(schema.recommenderMetrics.recommenderId, recommenderId))
//             .limit(1);

//         const row = recommenderMetrics[0] || undefined;

//         if (!row) return undefined;

//         return {
//             ...row,
//             recommenderId: row.recommenderId as UUID,
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//             lastActiveDate: new Date(row.lastActiveDate ?? new Date()),
//             trustScore: row.trustScore ?? 0,
//             totalRecommendations: row.totalRecommendations ?? 0,
//             successfulRecs: row.successfulRecs ?? 0,
//             avgTokenPerformance: row.avgTokenPerformance ?? 0,
//             riskScore: row.riskScore ?? 0,
//             consistencyScore: row.consistencyScore ?? 0,
//             virtualConfidence: row.virtualConfidence ?? 0,
//             trustDecay: row.trustDecay ?? 0,
//         };
//     }

//     /**
//      * Logs the current metrics of a recommender into the history table.
//      * @param recommenderId Recommender's UUID
//      */
//     async logRecommenderMetricsHistory(recommenderId: string): Promise<void> {
//         // Retrieve current metrics
//         const currentMetrics = await this.getRecommenderMetrics(recommenderId);
//         if (!currentMetrics) {
//             console.warn(
//                 `No metrics found for recommender ID: ${recommenderId}`
//             );
//             return;
//         }

//         // Create a history entry
//         const history: RecommenderMetricsHistory = {
//             historyId: uuidv4() as UUID,
//             recordedAt: new Date(), // Current timestamp
//             ...currentMetrics,
//         };

//         // Insert into recommender_metrics_history table
//         try {
//             await this.db.insert(schema.recommenderMetricsHistory).values({
//                 historyId: history.historyId,
//                 recommenderId: history.recommenderId,
//                 trustScore: history.trustScore,
//                 totalRecommendations: history.totalRecommendations,
//                 successfulRecs: history.successfulRecs,
//                 avgTokenPerformance: history.avgTokenPerformance,
//                 riskScore: history.riskScore,
//                 consistencyScore: history.consistencyScore,
//                 recordedAt: history.recordedAt,
//             });

//             console.log(
//                 `Logged metrics history for recommender ID: ${recommenderId}`
//             );
//         } catch (error) {
//             console.error("Error logging recommender metrics history:", error);
//         }
//     }

//     /**
//      * Updates metrics for a recommender.
//      * @param metrics RecommenderMetrics object
//      */
//     async updateRecommenderMetrics(metrics: RecommenderMetrics): Promise<void> {
//         // Log current metrics before updating
//         await this.logRecommenderMetricsHistory(metrics.recommenderId);

//         try {
//             await this.db
//                 .update(schema.recommenderMetrics)
//                 .set({
//                     trustScore: metrics.trustScore,
//                     totalRecommendations: metrics.totalRecommendations,
//                     successfulRecs: metrics.successfulRecs,
//                     avgTokenPerformance: metrics.avgTokenPerformance,
//                     riskScore: metrics.riskScore,
//                     consistencyScore: metrics.consistencyScore,
//                     updatedAt: new Date(),
//                 })
//                 .where(
//                     eq(
//                         schema.recommenderMetrics.recommenderId,
//                         metrics.recommenderId
//                     )
//                 );

//             console.log(
//                 `Updated metrics for recommender ID: ${metrics.recommenderId}`
//             );
//         } catch (error) {
//             console.error("Error updating recommender metrics:", error);
//         }
//     }

//     // ----- TokenPerformance Methods -----

//     /**
//      * Adds or updates token performance metrics.
//      * @param performance TokenPerformance object
//      */
//     async upsertTokenPerformance(
//         token: Omit<TokenPerformance, "createdAt" | "initialMarketCap">
//     ): Promise<boolean> {
//         try {
//             await this.db
//                 .insert(schema.tokenPerformance)
//                 .values({
//                     chain: token.chain,
//                     address: token.address ?? "",
//                     name: token.name,
//                     symbol: token.symbol,
//                     decimals: token.decimals,
//                     metadata: JSON.stringify(token.metadata),
//                     price: token.price,
//                     price24hChange: token.price24hChange,
//                     volume: token.volume,
//                     volume24hChange: token.volume24hChange,
//                     trades: token.trades,
//                     trades24hChange: token.trades24hChange,
//                     liquidity: token.liquidity,
//                     holders: token.holders,
//                     rugPull: token.rugPull,
//                     isScam: token.isScam,
//                     sustainedGrowth: token.sustainedGrowth,
//                     rapidDump: token.rapidDump,
//                     suspiciousVolume: token.suspiciousVolume,
//                     validationTrust: token.validationTrust,
//                     initialMarketCap: token.currentMarketCap, // Using currentMarketCap as initial on insert
//                     currentMarketCap: token.currentMarketCap,
//                     createdAt: token.updatedAt,
//                     updatedAt: token.updatedAt,
//                 })
//                 .onConflictDoUpdate({
//                     target: [
//                         schema.tokenPerformance.chain,
//                         schema.tokenPerformance.address,
//                     ],
//                     set: {
//                         name: token.name,
//                         symbol: token.symbol,
//                         decimals: token.decimals,
//                         metadata: JSON.stringify(token.metadata),
//                         price: token.price,
//                         price24hChange: token.price24hChange,
//                         volume: token.volume,
//                         volume24hChange: token.volume24hChange,
//                         trades: token.trades,
//                         trades24hChange: token.trades24hChange,
//                         liquidity: token.liquidity,
//                         holders: token.holders,
//                         currentMarketCap: token.currentMarketCap,
//                         rugPull: token.rugPull,
//                         isScam: token.isScam,
//                         sustainedGrowth: token.sustainedGrowth,
//                         rapidDump: token.rapidDump,
//                         suspiciousVolume: token.suspiciousVolume,
//                         validationTrust: token.validationTrust,
//                         updatedAt: token.updatedAt,
//                     },
//                 });

//             console.log(`Upserted token performance for ${token.address}`);
//             return true;
//         } catch (error) {
//             console.error("Error upserting token performance:", error);
//             return false;
//         }
//     }

//     /**
//      * Retrieves token performance metrics.
//      * @param tokenAddress Token's address
//      * @returns TokenPerformance object or null
//      */
//     async getTokenPerformance(
//         chain: string,
//         tokenAddress: string
//     ): Promise<TokenPerformance | null> {
//         const tokenPerformance = await this.db
//             .select()
//             .from(schema.tokenPerformance)
//             .where(
//                 and(
//                     eq(schema.tokenPerformance.chain, chain),
//                     eq(schema.tokenPerformance.address, tokenAddress)
//                 )
//             )
//             .limit(1);

//         const row = tokenPerformance[0] || undefined;
//         if (!row) return null;

//         return {
//             ...row,
//             metadata: row.metadata ?? {},
//             name: row.name ?? "",
//             symbol: row.symbol ?? "",
//             decimals: row.decimals ?? 0,
//             price: row.price ?? 0,
//             price24hChange: row.price24hChange ?? 0,
//             volume: row.volume ?? 0,
//             volume24hChange: row.volume24hChange ?? 0,
//             trades: row.trades ?? 0,
//             trades24hChange: row.trades24hChange ?? 0,
//             liquidity: row.liquidity ?? 0,
//             holders: row.holders ?? 0,
//             holders24hChange: row.holders24hChange ?? 0,
//             initialMarketCap: row.initialMarketCap ?? 0,
//             currentMarketCap: row.currentMarketCap ?? 0,
//             rugPull: Boolean(row.rugPull),
//             isScam: Boolean(row.isScam),
//             sustainedGrowth: Boolean(row.sustainedGrowth),
//             suspiciousVolume: Boolean(row.suspiciousVolume),
//             rapidDump: Boolean(row.rapidDump),
//             validationTrust: row.validationTrust ?? 0,
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//             createdAt: new Date(row.createdAt ?? new Date()),
//         };
//     }

//     async getOpenPositions(): Promise<Position[]> {
//         const positions = await this.db
//             .select()
//             .from(schema.positions)
//             .where(isNull(schema.positions.closedAt));

//         return positions.map((row) => ({
//             ...row,
//             id: row.id as UUID,
//             recommenderId: row.recommenderId as UUID,
//             recommendationId: row.recommendationId as UUID,
//             openedAt: new Date(row.openedAt ?? new Date()),
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//             closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
//             isSimulation: Boolean(row.isSimulation),
//             rapidDump: Boolean(row.rapidDump),
//             initialPrice: row.initialPrice ?? "0",
//             initialMarketCap: row.initialMarketCap ?? "0",
//             initialLiquidity: row.initialLiquidity ?? "0",
//             performanceScore: row.performanceScore ?? 0,
//             metadata: row.metadata ?? {},
//         }));
//     }

//     //get opne positions by recommender
//     async getOpenPositionsByRecommenderAndToken(
//         RecommenderId: string,
//         tokenAddress: string
//     ): Promise<Position[]> {
//         const positions = await this.db
//             .select()
//             .from(schema.positions)
//             .where(
//                 and(
//                     eq(schema.positions.recommenderId, RecommenderId),
//                     eq(schema.positions.tokenAddress, tokenAddress),
//                     isNull(schema.positions.closedAt)
//                 )
//             );

//         return positions.map((row) => ({
//             ...row,
//             id: row.id as UUID,
//             recommenderId: row.recommenderId as UUID,
//             recommendationId: row.recommendationId as UUID,
//             openedAt: new Date(row.openedAt ?? new Date()),
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//             closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
//             isSimulation: Boolean(row.isSimulation),
//             rapidDump: Boolean(row.rapidDump),
//             initialPrice: row.initialPrice ?? "0",
//             initialMarketCap: row.initialMarketCap ?? "0",
//             initialLiquidity: row.initialLiquidity ?? "0",
//             performanceScore: row.performanceScore ?? 0,
//             metadata: row.metadata ?? {},
//         }));
//     }

//     // ----- TokenRecommendations Methods -----

//     /**
//      * Calculates the average trust score of all recommenders who have recommended a specific token.
//      * @param tokenAddress The address of the token.
//      * @returns Promise<number> The average trust score (validationTrust).
//      */
//     async calculateValidationTrust(
//         chain: string,
//         tokenAddress: string
//     ): Promise<number> {
//         const rows = await this.db
//             .select({ trustScore: schema.recommenderMetrics.trustScore })
//             .from(schema.tokenRecommendations)
//             .innerJoin(
//                 schema.recommenderMetrics,
//                 eq(
//                     schema.tokenRecommendations.recommenderId,
//                     schema.recommenderMetrics.recommenderId
//                 )
//             )
//             .where(
//                 and(
//                     eq(schema.tokenRecommendations.chain, chain),
//                     eq(schema.tokenRecommendations.address, tokenAddress)
//                 )
//             );

//         if (rows.length === 0) return 0;

//         const totalTrust = rows.reduce(
//             (acc, row) => acc + (row.trustScore ?? 0),
//             0
//         );
//         return totalTrust / rows.length;
//     }

//     /**
//      * Adds a new token recommendation.
//      * @param recommendation TokenRecommendation object
//      * @returns Promise<boolean> indicating success
//      */
//     async addTokenRecommendation(
//         recommendation: TokenRecommendation,
//         tx?: PgTransaction<
//             NodePgQueryResultHKT,
//             typeof schema,
//             ExtractTablesWithRelations<typeof schema>
//         >
//     ): Promise<boolean> {
//         try {
//             const query = tx ?? this.db;
//             await query
//                 .insert(schema.tokenRecommendations)
//                 .values({
//                     id: recommendation.id,
//                     recommenderId: recommendation.recommenderId,
//                     chain: recommendation.chain,
//                     address: recommendation.tokenAddress,
//                     initialPrice: Number(recommendation.price),
//                     price: Number(recommendation.price),
//                     initialMarketCap: Number(recommendation.marketCap),
//                     marketCap: Number(recommendation.marketCap),
//                     initialLiquidity: Number(recommendation.liquidity),
//                     liquidity: Number(recommendation.liquidity),
//                     metadata: JSON.stringify(recommendation.metadata),
//                     status: recommendation.status,
//                     conviction: recommendation.conviction,
//                     tradeType: recommendation.type,
//                     createdAt: recommendation.createdAt,
//                     updatedAt: recommendation.updatedAt,
//                 })
//                 .onConflictDoNothing();
//             return true;
//         } catch (error) {
//             console.error("Error adding token recommendation:", error);
//             return false;
//         }
//     }

//     async updateTokenRecommendation(
//         recommendation: TokenRecommendation,
//         tx?: PgTransaction<
//             NodePgQueryResultHKT,
//             typeof schema,
//             ExtractTablesWithRelations<typeof schema>
//         >
//     ): Promise<boolean> {
//         try {
//             const query = tx ?? this.db;
//             await query
//                 .update(schema.tokenRecommendations)
//                 .set({
//                     marketCap: Number(recommendation.marketCap),
//                     liquidity: Number(recommendation.liquidity),
//                     price: Number(recommendation.price),
//                     riskScore: Number(recommendation.riskScore),
//                     performanceScore: Number(recommendation.performanceScore),
//                     updatedAt: recommendation.updatedAt,
//                     metadata: JSON.stringify(recommendation.metadata) ?? "{}",
//                 })
//                 .where(eq(schema.tokenRecommendations.id, recommendation.id));
//             console.log("updated token recommendation", recommendation.id);
//             return true;
//         } catch (error) {
//             console.error("Error adding token recommendation:", error);
//             return false;
//         }
//     }

//     /**
//      * Retrieves all recommendations made by a recommender.
//      * @param recommenderId Recommender's UUID
//      * @returns Promise<TokenRecommendation[]> Array of TokenRecommendation objects
//      */
//     async getRecommendationsByRecommender(
//         recommenderId: string,
//         tx?: PgTransaction<
//             NodePgQueryResultHKT,
//             typeof schema,
//             ExtractTablesWithRelations<typeof schema>
//         >
//     ): Promise<TokenRecommendation[]> {
//         const query = tx ?? this.db;
//         const rows = await query
//             .select()
//             .from(schema.tokenRecommendations)
//             .where(eq(schema.tokenRecommendations.recommenderId, recommenderId))
//             .orderBy(desc(schema.tokenRecommendations.createdAt));

//         if (!rows) return [];

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             recommenderId: row.recommenderId as UUID,
//             chain: row.chain,
//             tokenAddress: row.address,
//             conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
//             type: row.tradeType as
//                 | "BUY"
//                 | "DONT_BUY"
//                 | "SELL"
//                 | "DONT_SELL"
//                 | "NONE",
//             initialMarketCap: String(row.initialMarketCap ?? "0"),
//             initialLiquidity: String(row.initialLiquidity ?? "0"),
//             initialPrice: String(row.initialPrice ?? "0"),
//             marketCap: String(row.marketCap ?? "0"),
//             liquidity: String(row.liquidity ?? "0"),
//             price: String(row.price ?? "0"),
//             rugPull: Boolean(row.rugPull),
//             isScam: Boolean(row.isScam),
//             riskScore: row.riskScore ?? 0,
//             performanceScore: row.performanceScore ?? 0,
//             metadata: row.metadata ?? {},
//             status: row.status as
//                 | "ACTIVE"
//                 | "COMPLETED"
//                 | "EXPIRED"
//                 | "WITHDRAWN",
//             createdAt: new Date(row.createdAt ?? new Date()),
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//         }));
//     }

//     async calculateRecommenderMetrics(recommenderId: string): Promise<{
//         totalRecommendations: number;
//         lastActiveDate: Date;
//         avgTokenPerformance: number;
//         trustScore: number;
//         successfulRecs: number;
//         riskScore: number;
//     }> {
//         const result = await this.db
//             .select({
//                 totalRecommendations: count(),
//                 lastActiveDate: max(schema.tokenRecommendations.createdAt),
//                 avgTokenPerformance: avg(
//                     schema.tokenRecommendations.performanceScore
//                 ),
//                 riskScore: avg(schema.tokenRecommendations.riskScore),
//                 trustScore: sql<number>`LEAST(GREATEST(SUM(${schema.tokenRecommendations.performanceScore}) - SUM(${schema.tokenRecommendations.riskScore}), 0), 100)`,
//                 successfulRecs: sql<number>`SUM(CASE WHEN ${schema.tokenRecommendations.performanceScore} > 0 THEN 1 ELSE 0 END)`,
//             })
//             .from(schema.tokenRecommendations)
//             .where(
//                 eq(schema.tokenRecommendations.recommenderId, recommenderId)
//             );

//         const {
//             totalRecommendations,
//             lastActiveDate,
//             avgTokenPerformance,
//             riskScore,
//             trustScore,
//             successfulRecs,
//         } = result[0];

//         // Default trustScore to 0 if there are no recommendations
//         const finalTrustScore =
//             totalRecommendations > 0 ? Number(trustScore ?? 0) : 0;

//         return {
//             totalRecommendations,
//             avgTokenPerformance: Number(avgTokenPerformance ?? 0),
//             riskScore: Number(riskScore ?? 0),
//             trustScore: finalTrustScore,
//             successfulRecs: Number(successfulRecs ?? 0),
//             lastActiveDate: lastActiveDate ?? new Date(),
//         };
//     }

//     /**
//      * Retrieves all recommendations for a specific token.
//      * @param tokenAddress Token's address
//      * @returns Promise<TokenRecommendation[]> Array of TokenRecommendation objects
//      */
//     async getRecommendationsByToken(
//         tokenAddress: string
//     ): Promise<TokenRecommendation[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.tokenRecommendations)
//             .where(eq(schema.tokenRecommendations.address, tokenAddress))
//             .orderBy(desc(schema.tokenRecommendations.createdAt));

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             recommenderId: row.recommenderId as UUID,
//             chain: row.chain,
//             tokenAddress: row.address,
//             conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
//             type: row.tradeType as
//                 | "BUY"
//                 | "DONT_BUY"
//                 | "SELL"
//                 | "DONT_SELL"
//                 | "NONE",
//             initialMarketCap: String(row.initialMarketCap ?? "0"),
//             initialLiquidity: String(row.initialLiquidity ?? "0"),
//             initialPrice: String(row.initialPrice ?? "0"),
//             marketCap: String(row.marketCap ?? "0"),
//             liquidity: String(row.liquidity ?? "0"),
//             price: String(row.price ?? "0"),
//             rugPull: Boolean(row.rugPull),
//             isScam: Boolean(row.isScam),
//             riskScore: row.riskScore ?? 0,
//             performanceScore: row.performanceScore ?? 0,
//             metadata: JSON.parse(row.metadata as string) ?? {},
//             status: row.status as
//                 | "ACTIVE"
//                 | "COMPLETED"
//                 | "EXPIRED"
//                 | "WITHDRAWN",
//             createdAt: new Date(row.createdAt ?? new Date()),
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//         }));
//     }

//     /**
//      * Retrieves all recommendations within a specific timeframe.
//      * @param startDate Start date
//      * @param endDate End date
//      * @returns Array of TokenRecommendation objects
//      */
//     async getRecommendationsByDateRange(
//         startDate: Date,
//         endDate: Date
//     ): Promise<TokenRecommendation[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.tokenRecommendations)
//             .where(
//                 and(
//                     gte(schema.tokenRecommendations.createdAt, startDate),
//                     lte(schema.tokenRecommendations.createdAt, endDate)
//                 )
//             )
//             .orderBy(desc(schema.tokenRecommendations.createdAt));

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             recommenderId: row.recommenderId as UUID,
//             chain: row.chain,
//             tokenAddress: row.address,
//             conviction: row.conviction as "NONE" | "LOW" | "MEDIUM" | "HIGH",
//             type: row.tradeType as
//                 | "BUY"
//                 | "DONT_BUY"
//                 | "SELL"
//                 | "DONT_SELL"
//                 | "NONE",
//             initialMarketCap: String(row.initialMarketCap ?? "0"),
//             initialLiquidity: String(row.initialLiquidity ?? "0"),
//             initialPrice: String(row.initialPrice ?? "0"),
//             marketCap: String(row.marketCap ?? "0"),
//             liquidity: String(row.liquidity ?? "0"),
//             price: String(row.price ?? "0"),
//             rugPull: Boolean(row.rugPull),
//             isScam: Boolean(row.isScam),
//             riskScore: row.riskScore ?? 0,
//             performanceScore: row.performanceScore ?? 0,
//             metadata: JSON.parse(row.metadata as string) ?? {},
//             status: row.status as
//                 | "ACTIVE"
//                 | "COMPLETED"
//                 | "EXPIRED"
//                 | "WITHDRAWN",
//             createdAt: new Date(row.createdAt ?? new Date()),
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//         }));
//     }

//     /**
//      * Retrieves historical metrics for a recommender.
//      * @param recommenderId Recommender's UUID
//      * @returns Array of RecommenderMetricsHistory objects
//      */
//     async getRecommenderMetricsHistory(
//         recommenderId: string
//     ): Promise<RecommenderMetricsHistory[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.recommenderMetricsHistory)
//             .where(
//                 eq(
//                     schema.recommenderMetricsHistory.recommenderId,
//                     recommenderId
//                 )
//             )
//             .orderBy(desc(schema.recommenderMetricsHistory.recordedAt));

//         return rows.map((row) => ({
//             historyId: row.historyId as UUID,
//             recommenderId: row.recommenderId,
//             trustScore: row.trustScore ?? 0,
//             totalRecommendations: row.totalRecommendations ?? 0,
//             successfulRecs: row.successfulRecs ?? 0,
//             avgTokenPerformance: row.avgTokenPerformance ?? 0,
//             riskScore: row.riskScore ?? 0,
//             consistencyScore: row.consistencyScore ?? 0,
//             virtualConfidence: row.virtualConfidence ?? 0,
//             trustDecay: 0,
//             recordedAt: new Date(row.recordedAt ?? new Date()),
//         }));
//     }

//     async createPosition(position: Position): Promise<boolean> {
//         try {
//             await this.db.insert(schema.positions).values({
//                 id: position.id,
//                 walletAddress: position.walletAddress,
//                 isSimulation: position.isSimulation,
//                 chain: position.chain,
//                 tokenAddress: position.tokenAddress,
//                 recommenderId: position.recommenderId,
//                 recommendationId: position.recommendationId,
//                 initialPrice: position.initialPrice,
//                 initialMarketCap: position.initialMarketCap,
//                 initialLiquidity: position.initialLiquidity,
//                 rapidDump: position.rapidDump,
//                 openedAt: position.openedAt,
//                 updatedAt: position.updatedAt,
//             });
//             console.log(`Inserted position`, position);
//             return true;
//         } catch (error) {
//             console.error(`Error inserting position`, error);
//             return false;
//         }
//     }

//     async getPosition(id: UUID): Promise<Position | null> {
//         const position = await this.db
//             .select()
//             .from(schema.positions)
//             .where(eq(schema.positions.id, id))
//             .limit(1);

//         const row = position[0] ?? null;
//         if (!row) return null;

//         return {
//             id: row.id as UUID,
//             chain: row.chain,
//             tokenAddress: row.tokenAddress,
//             walletAddress: row.walletAddress,
//             isSimulation: Boolean(row.isSimulation),
//             recommenderId: row.recommenderId as UUID,
//             recommendationId: row.recommendationId as UUID,
//             initialPrice: row.initialPrice ?? "0",
//             initialMarketCap: row.initialMarketCap ?? "0",
//             initialLiquidity: row.initialLiquidity ?? "0",
//             performanceScore: row.performanceScore ?? 0,
//             rapidDump: Boolean(row.rapidDump),
//             openedAt: new Date(row.openedAt ?? new Date()),
//             closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//         };
//     }

//     async getPositionInvestment(id: UUID): Promise<bigint> {
//         const position = await this.db
//             .select({
//                 investedAmount: sql<string>`SUM(${schema.transactions.solAmount})`,
//             })
//             .from(schema.transactions)
//             .where(
//                 and(
//                     eq(schema.transactions.positionId, id),
//                     eq(schema.transactions.type, "BUY")
//                 )
//             )
//             .limit(1);

//         const row = position[0] ?? null;

//         if (!row) return 0n;

//         return BigInt(row.investedAmount ?? 0);
//     }

//     async getPositionBalance(id: UUID): Promise<bigint> {
//         const position = await this.db
//             .select({
//                 balance: sql<string>`
//                     SUM(CASE
//                         WHEN ${schema.transactions.type} = 'BUY' THEN ${schema.transactions.amount}
//                         WHEN ${schema.transactions.type} = 'SELL' THEN -${schema.transactions.amount}
//                         WHEN ${schema.transactions.type} = 'TRANSFER_IN' THEN ${schema.transactions.amount}
//                         WHEN ${schema.transactions.type} = 'TRANSFER_OUT' THEN -${schema.transactions.amount}
//                         ELSE 0
//                     END)
//                 `,
//             })
//             .from(schema.transactions)
//             .where(eq(schema.transactions.positionId, id))
//             .limit(1);

//         const row = position[0] ?? null;

//         if (!row) return 0n;

//         return BigInt(row.balance ?? 0);
//     }

//     async getOpenPositionsWithBalance(): Promise<any> {
//         const rows = await this.db
//             .select({
//                 id: schema.positions.id,
//                 chain: schema.positions.chain,
//                 tokenAddress: schema.positions.tokenAddress,
//                 walletAddress: schema.positions.walletAddress,
//                 isSimulation: schema.positions.isSimulation,
//                 recommenderId: schema.positions.recommenderId,
//                 recommendationId: schema.positions.recommendationId,
//                 initialPrice: schema.positions.initialPrice,
//                 initialMarketCap: schema.positions.initialMarketCap,
//                 initialLiquidity: schema.positions.initialLiquidity,
//                 performanceScore: schema.positions.performanceScore,
//                 rapidDump: schema.positions.rapidDump,
//                 openedAt: schema.positions.openedAt,
//                 closedAt: schema.positions.closedAt,
//                 updatedAt: schema.positions.updatedAt,
//                 balance: sql<string>`
//                     COALESCE((
//                         SELECT SUM(CASE
//                             WHEN type = 'BUY' THEN amount
//                             WHEN type = 'SELL' THEN -amount
//                             WHEN type = 'TRANSFER_IN' THEN amount
//                             WHEN type = 'TRANSFER_OUT' THEN -amount
//                             ELSE 0
//                         END)
//                         FROM ${schema.transactions}
//                         WHERE ${schema.transactions.positionId} = ${schema.positions.id}
//                     ), 0)
//                 `,
//             })
//             .from(schema.positions)
//             .where(isNull(schema.positions.closedAt));

//         // filter out positions with 0 balance
//         // rows.filter((row) => BigInt(row.balance) > 0n);
//         if (rows.length === 0) return [];

//         return rows.map((row) => ({
//             balance: BigInt(row.balance),
//             id: row.id as UUID,
//             chain: row.chain,
//             tokenAddress: row.tokenAddress,
//             walletAddress: row.walletAddress,
//             isSimulation: Boolean(row.isSimulation),
//             recommenderId: row.recommenderId as UUID,
//             recommendationId: row.recommendationId as UUID,
//             initialPrice: row.initialPrice ?? "0",
//             initialMarketCap: row.initialMarketCap ?? "0",
//             initialLiquidity: row.initialLiquidity ?? "0",
//             performanceScore: row.performanceScore ?? 0,
//             rapidDump: Boolean(row.rapidDump),
//             openedAt: new Date(row.openedAt ?? new Date()),
//             closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
//             updatedAt: new Date(row.updatedAt ?? new Date()),
//         }));
//     }

//     // ----- Transactions Methods -----
//     /**
//      * Adds a new transaction to the database.
//      * @param transaction Transaction object
//      * @returns boolean indicating success
//      */

//     async addTransaction(transaction: Transaction): Promise<boolean> {
//         try {
//             await this.db.insert(schema.transactions).values({
//                 // @ts-ignore
//                 id: transaction.id,
//                 positionId: transaction.positionId,
//                 type: transaction.type,
//                 isSimulation: transaction.isSimulation,
//                 chain: transaction.chain,
//                 address: transaction.tokenAddress,
//                 transactionHash: transaction.transactionHash,
//                 amount: transaction.amount,
//                 valueUsd: transaction.valueUsd ?? null,
//                 price: transaction.price ?? null,
//                 solAmount: transaction.solAmount ?? null,
//                 solValueUsd: transaction.solValueUsd ?? null,
//                 solPrice: transaction.solPrice ?? null,
//                 marketCap: transaction.marketCap ?? null,
//                 liquidity: transaction.liquidity ?? null,
//                 timestamp: transaction.timestamp,
//             });
//             return true;
//         } catch (error) {
//             console.error("Error adding transaction:", error);
//             return false;
//         }
//     }

//     async getPositionTransactions(positionId: UUID): Promise<Transaction[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.transactions)
//             .where(eq(schema.transactions.positionId, positionId));

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             type: row.type as "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT",
//             positionId: row.positionId as UUID,
//             isSimulation: Boolean(row.isSimulation),
//             chain: row.chain,
//             tokenAddress: row.address,
//             transactionHash: row.transactionHash,
//             amount: BigInt(row.amount),
//             valueUsd: row.valueUsd ?? undefined,
//             price: row.price ?? undefined,
//             solAmount: row.solAmount ? BigInt(row.solAmount) : undefined,
//             solValueUsd: row.solValueUsd ?? undefined,
//             solPrice: row.solPrice ?? undefined,
//             marketCap: row.marketCap ?? undefined,
//             liquidity: row.liquidity ?? undefined,
//             timestamp: new Date(row.timestamp ?? new Date()),
//         }));
//     }

//     async getPositionsTransactions(
//         positionIds: UUID[]
//     ): Promise<Transaction[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.transactions)
//             .where(inArray(schema.transactions.positionId, positionIds));

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             type: row.type as "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT",
//             positionId: row.positionId as UUID,
//             isSimulation: Boolean(row.isSimulation),
//             chain: row.chain,
//             tokenAddress: row.address,
//             transactionHash: row.transactionHash,
//             amount: BigInt(row.amount),
//             valueUsd: row.valueUsd ?? undefined,
//             price: row.price ?? undefined,
//             solAmount: row.solAmount ? BigInt(row.solAmount) : undefined,
//             solValueUsd: row.solValueUsd ?? undefined,
//             solPrice: row.solPrice ?? undefined,
//             marketCap: row.marketCap ?? undefined,
//             liquidity: row.liquidity ?? undefined,
//             timestamp: new Date(row.timestamp ?? new Date()),
//         }));
//     }

//     async updatePosition(position: Position): Promise<boolean> {
//         try {
//             await this.db
//                 .update(schema.positions)
//                 .set({
//                     performanceScore: position.performanceScore,
//                     updatedAt: position.updatedAt,
//                 })
//                 .where(eq(schema.positions.id, position.id));
//             console.log(`Updated position`, position);
//             return true;
//         } catch (error) {
//             console.error(`Error updating position`, error);
//             return false;
//         }
//     }

//     async touchPosition(id: UUID) {
//         try {
//             await this.db
//                 .update(schema.positions)
//                 .set({
//                     updatedAt: new Date(),
//                 })
//                 .where(eq(schema.positions.id, id));
//         } catch (error) {}
//     }

//     async closePosition(id: UUID) {
//         try {
//             await this.db
//                 .update(schema.positions)
//                 .set({
//                     closedAt: new Date(),
//                 })
//                 .where(eq(schema.positions.id, id));
//         } catch (error) {}
//     }

//     async closePositions(ids: UUID[]) {
//         try {
//             await this.db
//                 .update(schema.positions)
//                 .set({
//                     closedAt: new Date(),
//                 })
//                 .where(inArray(schema.positions.id, ids));
//         } catch (error) {}
//     }

//     async getMessagesByUserId(
//         userId: UUID,
//         limit: number = 10
//     ): Promise<Memory[]> {
//         const rows = await this.db
//             .select()
//             .from(schema.memories)
//             .where(
//                 and(
//                     eq(schema.memories.userId, userId),
//                     eq(schema.memories.type, "messages")
//                 )
//             )
//             .orderBy(desc(schema.memories.createdAt))
//             .limit(limit);

//         return rows.map((row) => ({
//             id: row.id as UUID,
//             userId: row.userId as UUID,
//             roomId: row.roomId as UUID,
//             agentId: row.agentId as UUID,
//             createdAt: row.createdAt ? row.createdAt.getTime() : undefined,
//             content: JSON.parse(row.content),
//             type: row.type,
//         }));
//     }
// }