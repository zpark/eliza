import {
  type Adapter,
  logger,
  type IAgentRuntime,
  type Plugin,
  type IDatabaseAdapter,
  type IDatabaseCacheAdapter,
} from "@elizaos/core";
import { PgDatabaseAdapter } from "./pg/adapter";
import { PgliteDatabaseAdapter } from "./pg-lite/adapter";
import { PGliteClientManager } from "./pg-lite/manager";
import { PostgresConnectionManager } from "./pg/manager";

let pgLiteClientManager: PGliteClientManager;

export function createDatabaseAdapter(config: {
  dataDir?: string;
  postgresUrl?: string;
}): IDatabaseAdapter & IDatabaseCacheAdapter {
  if (config.postgresUrl) {
    const manager = new PostgresConnectionManager(config.postgresUrl);
    return new PgDatabaseAdapter(manager);
  }

  const dataDir = config.dataDir ?? "../../pgLite";

  if (!pgLiteClientManager) {
    pgLiteClientManager = new PGliteClientManager({ dataDir });
  }
  return new PgliteDatabaseAdapter(pgLiteClientManager);
}

const drizzleDatabaseAdapter: Adapter = {
  init: async (runtime: IAgentRuntime) => {
    const config = {
      dataDir: runtime.getSetting("PGLITE_DATA_DIR"),
      postgresUrl: runtime.getSetting("POSTGRES_URL"),
    };

    try {
      const db = createDatabaseAdapter(config);
      await db.init();
      logger.success("Database connection established successfully");
      return db;
    } catch (error) {
      logger.error("Failed to initialize database:", error);
      throw error;
    }
  },
};

const drizzlePlugin: Plugin = {
  name: "drizzle",
  description: "Database adapter plugin using Drizzle ORM",
  adapters: [drizzleDatabaseAdapter],
};

export default drizzlePlugin;
