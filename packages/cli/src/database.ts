import Database from "better-sqlite3"
import { SqliteDatabaseAdapter } from "@elizaos/plugin-sqlite"
  
  // Initialize database
  export const adapter = new SqliteDatabaseAdapter(new Database("./eliza.db"))
  