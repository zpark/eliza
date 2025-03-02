import { logger, UUID } from "@elizaos/core";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseDrizzleAdapter } from "../base";
import { DIMENSION_MAP, type EmbeddingDimensionColumn } from "../schema/embedding";
import type { PostgresConnectionManager } from "./manager";

export class PgDatabaseAdapter extends BaseDrizzleAdapter<NodePgDatabase> {
    protected embeddingDimension: EmbeddingDimensionColumn = DIMENSION_MAP[384];

    constructor(agentId: UUID, private manager: PostgresConnectionManager) {
        super(agentId);
        this.manager = manager;
        this.db = drizzle(this.manager.getConnection());
    }

    protected async withDatabase<T>(operation: () => Promise<T>): Promise<T> {
        return await this.withRetry(operation);
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
