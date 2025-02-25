import {
    pgTable,
    uuid,
    text,
    jsonb,
    vector,
    index,
    boolean,
    foreignKey,
    unique,
    check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
    numberTimestamp,
} from "./types";
import { entityTable } from "./entity";
import { roomTable } from "./room";
import { embeddingTable } from "./embedding";
import { agentTable } from "./agent";

export const memoryTable = pgTable(
    "memories",
    {
        id: uuid("id").primaryKey().notNull(),
        type: text("type").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        content: jsonb("content").notNull(),
        userId: uuid("userId").references(() => entityTable.id),
        agentId: uuid("agentId").references(() => agentTable.id),
        roomId: uuid("roomId").references(() => roomTable.id),
        unique: boolean("unique").default(true).notNull(),
        metadata: jsonb("metadata").default({}).notNull(),
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
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_agent",
            columns: [table.agentId],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
        index("idx_memories_metadata_type").on(sql`((metadata->>'type'))`),
        index("idx_memories_document_id").on(sql`((metadata->>'documentId'))`),
        index("idx_fragments_order").on(
            sql`((metadata->>'documentId'))`,
            sql`((metadata->>'position'))`
        ),
        check("fragment_metadata_check", sql`
            CASE 
                WHEN metadata->>'type' = 'fragment' THEN
                    metadata ? 'documentId' AND 
                    metadata ? 'position'
                ELSE true
            END
        `),
        check("document_metadata_check", sql`
            CASE 
                WHEN metadata->>'type' = 'document' THEN
                    metadata ? 'timestamp'
                ELSE true
            END
        `)
    ]
);

export const memoryRelations = relations(memoryTable, ({ one }) => ({
    embedding: one(embeddingTable),
}));
