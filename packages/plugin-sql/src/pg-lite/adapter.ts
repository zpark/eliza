import { logger } from "@elizaos/core";
import { drizzle, PgliteDatabase } from "drizzle-orm/pglite";
import { DIMENSION_MAP, EmbeddingDimensionColumn } from "../schema/embedding";
import { type PGliteClientManager } from "./manager";
import { BaseDrizzleAdapter } from "../base";

export class PgliteDatabaseAdapter extends BaseDrizzleAdapter<PgliteDatabase> {
    private manager: PGliteClientManager;
    protected embeddingDimension: EmbeddingDimensionColumn = DIMENSION_MAP[384];

    constructor(manager: PGliteClientManager) {
        super();
        this.manager = manager;
        this.db = drizzle(this.manager.getConnection());
    }

    protected async withDatabase<T>(operation: () => Promise<T>): Promise<T> {
        if (this.manager.isShuttingDown()) {
            logger.warn("Database is shutting down");
            return null as unknown as T;
        }
        return operation();
    }

    async init(): Promise<void> {
        try {
            await this.manager.runMigrations();
        } catch (error) {
            logger.error("Failed to initialize database:", error);
            throw error;
        }
    }

    async close() {
        await this.manager.close();
    }
}
