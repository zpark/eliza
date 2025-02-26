import { logger } from "@elizaos/core";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { DIMENSION_MAP, type EmbeddingDimensionColumn } from "../schema/embedding";
import type { PostgresConnectionManager } from "./manager";
import { BaseDrizzleAdapter } from "../base";

export class PgDatabaseAdapter extends BaseDrizzleAdapter<NodePgDatabase> {
    protected embeddingDimension: EmbeddingDimensionColumn = DIMENSION_MAP[384];

    constructor(private manager: PostgresConnectionManager) {
        super();
        this.manager = manager;
        this.db = drizzle(this.manager.getConnection());
    }

    protected async withDatabase<T>(operation: () => Promise<T>): Promise<T> {
        return this.withRetry(operation);
    }

    async init(): Promise<void> {
        try {
            await this.manager.runMigrations();
            logger.info("PgDatabaseAdapter initialized successfully");
        } catch (error) {
            logger.error("Failed to initialize PgDatabaseAdapter:", error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.manager.close();
    }
}
