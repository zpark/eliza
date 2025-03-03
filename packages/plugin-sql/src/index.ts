import {
  type Adapter,
  type IAgentRuntime,
  type IDatabaseAdapter,
  logger,
  type Plugin,
  type UUID,
} from "@elizaos/core";
import { PgliteDatabaseAdapter } from "./pg-lite/adapter";
import { PGliteClientManager } from "./pg-lite/manager";
import { PgDatabaseAdapter } from "./pg/adapter";
import { PostgresConnectionManager } from "./pg/manager";

let pgLiteClientManager: PGliteClientManager;

export function createDatabaseAdapter(
  config: {
    dataDir?: string;
    postgresUrl?: string;
  },
  agentId: UUID
): IDatabaseAdapter {
  if (config.postgresUrl) {
    const manager = new PostgresConnectionManager(config.postgresUrl);
    return new PgDatabaseAdapter(agentId, manager);
  }

  const dataDir = config.dataDir ?? "../../pgLite";

  if (!pgLiteClientManager) {
    pgLiteClientManager = new PGliteClientManager({ dataDir });
  }
  return new PgliteDatabaseAdapter(agentId, pgLiteClientManager);
}

const drizzleDatabaseAdapter: Adapter = {
  init: async (runtime: IAgentRuntime) => {
    const config = {
      dataDir: runtime.getSetting("PGLITE_DATA_DIR"),
      postgresUrl: runtime.getSetting("POSTGRES_URL"),
    };

    try {
      const db = createDatabaseAdapter(config, runtime.agentId);
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
