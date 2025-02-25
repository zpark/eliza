import { boolean, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { characterTable } from "./character";

export const agentTable = pgTable("agents", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: numberTimestamp("createdAt")
        .default(sql`now()`)
        .notNull(),
    characterId: uuid("characterId").references(() => characterTable.id),
    enabled: boolean("enabled").default(true).notNull(),
});
