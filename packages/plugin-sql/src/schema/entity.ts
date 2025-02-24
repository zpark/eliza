import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";

export const entityTable = pgTable("entities", {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    agentId: uuid("agentId").notNull(),
    createdAt: numberTimestamp("createdAt")
        .default(sql`now()`)
        .notNull(),
    names: text("names").array().default(sql`'{}'::text[]`),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});
