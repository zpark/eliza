import { DrizzleDatabaseAdapter } from "@elizaos/plugin-sql";

// Initialize database adapter
export const adapter = new DrizzleDatabaseAdapter({
  connectionString: process.env.POSTGRES_URL,
});
