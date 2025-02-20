import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { stringJsonb } from "./types";

export const cacheTable = pgTable(
    "cache",
    {
        key: text("key").notNull(),
        agentId: text("agentId").notNull(),
        value: stringJsonb("value").default(sql`'{}'::jsonb`),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        expiresAt: numberTimestamp("expiresAt"),
    },
    (table) => [unique("cache_key_agent_unique").on(table.key, table.agentId)]
);
