import { pgTable, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";

export const roomTable = pgTable("rooms", {
    id: uuid("id").primaryKey().notNull(),
    createdAt: numberTimestamp("createdAt")
        .default(sql`now()`)
        .notNull(),
});
