import {
    pgTable,
    uuid,
    text,
    index,
    foreignKey,
    jsonb,
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
        entityA: uuid("entityA")
            .notNull()
            .references(() => entityTable.id),
        entityB: uuid("entityB")
            .notNull()
            .references(() => entityTable.id),
        agentId: uuid("agentId")
            .notNull()
            .references(() => agentTable.id),
        tags: text("tags").array(),
        metadata: jsonb("metadata"),
    },
    (table) => [
        index("idx_relationships_users").on(table.entityA, table.entityB),
        foreignKey({
            name: "fk_user_a",
            columns: [table.entityA],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_user_b",
            columns: [table.entityB],
            foreignColumns: [entityTable.id],
        }).onDelete("cascade"),
    ]
);
