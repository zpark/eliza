import { sql } from "drizzle-orm";
import { pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { agentTable } from "./agent";
import { numberTimestamp, stringJsonb } from "./types";

export const cacheTable = pgTable(
    "cache",
    {
        id: uuid("id").notNull().primaryKey().default(sql`gen_random_uuid()`),
        key: text("key").notNull(),
        agentId: uuid("agentId").notNull().references(() => agentTable.id),
        value: stringJsonb("value").default(sql`'{}'::jsonb`),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        expiresAt: numberTimestamp("expiresAt"),
    },
    (table) => [unique("cache_key_agent_unique").on(table.key, table.agentId)]
);
