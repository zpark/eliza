import {
    pgTable,
    uuid,
    text,
    index,
    foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { accountTable } from "./account";

export const relationshipTable = pgTable(
    "relationships",
    {
        id: uuid("id").notNull(),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        userA: uuid("userA")
            .notNull()
            .references(() => accountTable.id),
        userB: uuid("userB")
            .notNull()
            .references(() => accountTable.id),
        status: text("status"),
        userId: uuid("userId")
            .notNull()
            .references(() => accountTable.id),
    },
    (table) => [
        index("idx_relationships_users").on(table.userA, table.userB),
        foreignKey({
            name: "fk_user_a",
            columns: [table.userA],
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user_b",
            columns: [table.userB],
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user",
            columns: [table.userId],
            foreignColumns: [accountTable.id],
        }).onDelete("cascade"),
    ]
);
