import { DrizzleDatabaseAdapter } from "@elizaos/plugin-drizzle";

// Initialize database adapter
export const adapter = new DrizzleDatabaseAdapter({
  connectionString: process.env.POSTGRES_URL,
});
