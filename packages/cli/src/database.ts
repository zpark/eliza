import { createDatabaseAdapter } from "@elizaos/plugin-sql";

export const adapter = createDatabaseAdapter({
  dataDir: process.env.PGLITE_DATA_DIR,
  postgresUrl: process.env.POSTGRES_URL,
});
