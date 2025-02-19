import {
    pgTable,
    uuid,
    text,
    jsonb,
    vector,
    index,
    boolean,
    foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
    numberTimestamp,
} from "./types";
import { accountTable } from "./account";
import { roomTable } from "./room";
import { embeddingTable } from "./embedding";

export const memoryTable = pgTable(
    "memories",
    {
        id: uuid("id").primaryKey().notNull(),
        type: text("type").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        content: jsonb("content").notNull(),
        userId: uuid("userId").references(() => accountTable.id),
        agentId: uuid("agentId").references(() => accountTable.id),
        roomId: uuid("roomId").references(() => roomTable.id),
        unique: boolean("unique").default(true).notNull(),
    },
    (table) => [
        index("idx_memories_type_room").on(table.type, table.roomId),
        foreignKey({
            name: "fk_room",
            columns: [table.roomId],
            foreignColumns: [roomTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user",
            columns: [table.userId],
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_agent",
            columns: [table.agentId],
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
    ]
);

export const memoryRelations = relations(memoryTable, ({ one }) => ({
    embedding: one(embeddingTable),
}));
