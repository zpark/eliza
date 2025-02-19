import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";

export const accountTable = pgTable("accounts", {
    id: uuid("id").primaryKey().notNull(),
    createdAt: numberTimestamp("createdAt")
        .default(sql`now()`)
        .notNull(),
    name: text("name"),
    username: text("username").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatarUrl"),
    details: jsonb("details").default(sql`'{}'::jsonb`),
});
