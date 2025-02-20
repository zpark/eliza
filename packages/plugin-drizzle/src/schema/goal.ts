import { pgTable, uuid, text, jsonb, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { accountTable } from "./account";
import { roomTable } from "./room";

export const goalTable = pgTable(
    "goals",
    {
        id: uuid("id").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        userId: uuid("userId").references(() => accountTable.id),
        name: text("name"),
        status: text("status"),
        description: text("description"),
        roomId: uuid("roomId").references(() => roomTable.id),
        objectives: jsonb("objectives").default("[]").notNull(),
    },
    (table) => [
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
