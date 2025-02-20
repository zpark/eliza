import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { worldTable } from "./worldTable";
import { accountTable } from "./account";

export const roomTable = pgTable("rooms", {
  id: uuid("id").primaryKey().notNull(),
  agentId: uuid("agentId").references(() => accountTable.id),
  source: text("source").notNull(),
  type: text("type").notNull(),
  serverId: text("serverId"),
  worldId: uuid("worldId").references(() => worldTable.id),
  name: text("name"),
  metadata: jsonb("metadata"),
  channelId: text("channelId"),
  createdAt: numberTimestamp("createdAt")
    .default(sql`now()`)
    .notNull(),
});
