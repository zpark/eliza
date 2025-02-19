import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";

export const roomTable = pgTable("rooms", {
    id: uuid("id").primaryKey().notNull(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    serverId: text("serverId"),
    channelId: text("channelId"),
    createdAt: numberTimestamp("createdAt")
        .default(sql`now()`)
        .notNull(),
});