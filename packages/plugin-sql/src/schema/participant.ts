import {
    pgTable,
    uuid,
    text,
    index,
    foreignKey,
    unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { entityTable } from "./entity";
import { roomTable } from "./room";
import { agentTable } from "./agent";

export const participantTable = pgTable(
    "participants",
    {
        id: uuid("id").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        userId: uuid("userId").references(() => entityTable.id),
        roomId: uuid("roomId").references(() => roomTable.id),
        agentId: uuid("agentId").references(() => agentTable.id),
        roomState: text("roomState"),
    },
    (table) => [
        // unique("participants_user_room_agent_unique").on(table.userId, table.roomId, table.agentId),
        index("idx_participants_user").on(table.userId),
        index("idx_participants_room").on(table.roomId),
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
    ]
);
