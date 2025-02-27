import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { 
    Character,
    TemplateType,
    MessageExample,
} from "@elizaos/core";
import { numberTimestamp } from "./types";

export type StoredTemplate = {
    type: 'string' | 'function';
    value: string;
};

export type StoredTemplates = {
    [key: string]: StoredTemplate;
};

export const characterTable = pgTable("characters", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    username: text("username"),
    system: text("system"),
    templates: jsonb("templates").$type<StoredTemplates>().default(sql`'{}'::jsonb`),
    bio: jsonb("bio").$type<string | string[]>().notNull(),
    messageExamples: jsonb("message_examples").$type<MessageExample[][]>().default(sql`'[]'::jsonb`),
    postExamples: jsonb("post_examples").$type<string[]>().default(sql`'[]'::jsonb`),
    topics: jsonb("topics").$type<string[]>().default(sql`'[]'::jsonb`),
    adjectives: jsonb("adjectives").$type<string[]>().default(sql`'[]'::jsonb`),
    knowledge: jsonb("knowledge").$type<(string | { path: string; shared?: boolean })[]>().default(sql`'[]'::jsonb`),
    plugins: jsonb("plugins").$type<string[]>().default(sql`'[]'::jsonb`),
    settings: jsonb("settings").$type<{
        secrets?: { [key: string]: string | boolean | number };
        [key: string]: any;
    }>().default(sql`'{}'::jsonb`),
    style: jsonb("style").$type<{
        all?: string[];
        chat?: string[];
        post?: string[];
    }>().default(sql`'{}'::jsonb`),
    createdAt: numberTimestamp("created_at").default(sql`now()`),
});

export const templateToStored = (template: TemplateType): StoredTemplate => {
    if (typeof template === 'string') {
        return { type: 'string', value: template };
    }
    return { type: 'function', value: template.toString() };
};

export const storedToTemplate = (stored: StoredTemplate): TemplateType => {
    if (stored.type === 'string') {
        return stored.value;
    }
    return JSON.parse(stored.value);
};

export const characterToInsert = (
    character: Character,
): typeof characterTable.$inferInsert => {
    return {
        username: character.username || "",
        name: character.name,
        system: character.system,
        templates: character.templates 
            ? Object.fromEntries(
                Object.entries(character.templates).map(
                    ([key, value]) => [key, templateToStored(value)]
                )
            )
            : {},
        bio: character.bio,
        messageExamples: character.messageExamples || [],
        postExamples: character.postExamples || [],
        topics: character.topics || [],
        adjectives: character.adjectives || [],
        knowledge: character.knowledge || [],
        plugins: character.plugins || [],
        settings: character.settings || {},
        style: character.style || {},
    };
};