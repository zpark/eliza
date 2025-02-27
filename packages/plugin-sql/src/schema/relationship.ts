import {
    pgTable,
    uuid,
    text,
    index,
    foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { entityTable } from "./entity";
import { agentTable } from "./agent";

export const relationshipTable = pgTable(
    "relationships",
    {
        id: uuid("id").notNull().primaryKey().default(sql`gen_random_uuid()`),
        createdAt: numberTimestamp("createdAt")
            .default(sql`now()`)
            .notNull(),
        userA: uuid("userA")
            .notNull()
            .references(() => entityTable.id),
        userB: uuid("userB")
            .notNull()
            .references(() => entityTable.id),
        agentId: uuid("agentId")
            .notNull()
            .references(() => agentTable.id),
        status: text("status"),
        userId: uuid("userId")
            .notNull()
            .references(() => entityTable.id),
    },
    (table) => [
        index("idx_relationships_users").on(table.userA, table.userB),
        foreignKey({
            name: "fk_user_a",
            columns: [table.userA],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user_b",
            columns: [table.userB],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user",
            columns: [table.userId],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
    ]
);
