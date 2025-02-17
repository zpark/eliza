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
import { accountTable } from "./account";
import { roomTable } from "./room";

export const participantTable = pgTable(
    "participants",
    {
        id: uuid("id").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        userId: uuid("userId").references(() => accountTable.id),
        roomId: uuid("roomId").references(() => roomTable.id),
        userState: text("userState"),
        lastMessageRead: text("last_message_read"),
    },
    (table) => [
        unique("participants_user_room_unique").on(table.userId, table.roomId),
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
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
    ]
);
