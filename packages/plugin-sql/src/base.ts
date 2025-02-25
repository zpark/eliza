import {
    Agent,
    DatabaseAdapter,
    logger,
    type Character,
    type Entity,
    type Goal,
    type GoalStatus,
    type IDatabaseCacheAdapter,
    type Memory,
    type Participant,
    type Relationship,
    type RoomData,
    type UUID,
    type WorldData
} from "@elizaos/core";
import {
    and,
    cosineDistance,
    desc,
    eq,
    gte,
    inArray,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { v4 } from "uuid";
import {
    characterToInsert,
    StoredTemplate,
    storedToTemplate,
    templateToStored,
} from "./schema/character";
import { DIMENSION_MAP, EmbeddingDimensionColumn } from "./schema/embedding";
import {
    cacheTable,
    characterTable,
    embeddingTable,
    entityTable,
    goalTable,
    logTable,
    agentTable,
    memoryTable,
    participantTable,
    relationshipTable,
    roomTable,
    worldTable,
} from "./schema/index";
import { DrizzleOperations } from "./types";

export abstract class BaseDrizzleAdapter<TDatabase extends DrizzleOperations> 
    extends DatabaseAdapter<TDatabase>
    implements IDatabaseCacheAdapter
{
    protected readonly maxRetries: number = 3;
    protected readonly baseDelay: number = 1000;
    protected readonly maxDelay: number = 10000;
    protected readonly jitterMax: number = 1000;
    protected embeddingDimension: EmbeddingDimensionColumn = DIMENSION_MAP[384];

    protected abstract withDatabase<T>(operation: () => Promise<T>): Promise<T>;
    public abstract init(): Promise<void>;
    public abstract close(): Promise<void>;

    protected async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: Error = new Error("Unknown error");

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.maxRetries) {
                    const backoffDelay = Math.min(
                        this.baseDelay * 2 ** (attempt - 1),
                        this.maxDelay
                    );

                    const jitter = Math.random() * this.jitterMax;
                    const delay = backoffDelay + jitter;

                    logger.warn(
                        `Database operation failed (attempt ${attempt}/${this.maxRetries}):`,
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                            nextRetryIn: `${(delay / 1000).toFixed(1)}s`,
                        }
                    );

                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    logger.error("Max retry attempts reached:", {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        totalAttempts: attempt,
                    });
                    throw error instanceof Error
                        ? error
                        : new Error(String(error));
                }
            }
        }

        throw lastError;
    }

    async ensureEmbeddingDimension(dimension: number, agentId: UUID) {
        const existingMemory = await this.db
            .select({
                embedding: embeddingTable,
            })
            .from(memoryTable)
            .innerJoin(
                embeddingTable,
                eq(embeddingTable.memoryId, memoryTable.id)
            )
            .where(eq(memoryTable.agentId, agentId))
            .limit(1);

        if (existingMemory.length > 0) {
            const usedDimension = Object.entries(DIMENSION_MAP).find(
                ([_, colName]) => existingMemory[0].embedding[colName] !== null
            );

            if (
                usedDimension &&
                usedDimension[1] !== DIMENSION_MAP[dimension]
            ) {
                throw new Error("Cannot change embedding dimension for agent");
            }
        }

        this.embeddingDimension = DIMENSION_MAP[dimension];
    }

    async getAgent(agentId: UUID): Promise<Agent | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select()
                .from(agentTable)
                .where(eq(agentTable.id, agentId))
                .limit(1);

            if (result.length === 0) return null;
            return result[0];
        });
    }

    async createAgent(agent: Agent): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                return await this.db.transaction(async (tx) => {
                    await tx.insert(agentTable).values(agent);
                    logger.debug("Agent created successfully:", {
                        agentId: agent.id
                    });
                    return true;
                });
            } catch (error) {
                logger.error("Error creating agent:", {
                    error: error instanceof Error ? error.message : String(error),
                    agentId: agent.id,
                    agent
                });
                console.trace();
                return false;
            }
        });
    }
  
    async updateAgent(agent: Agent): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                await this.db
                    .update(agentTable)
                    .set({
                        characterId: agent.characterId,
                        enabled: agent.enabled
                    })
                    .where(eq(agentTable.id, agent.id));
                return true;
            } catch (error) {
                logger.error("Error updating agent:", {
                    error: error instanceof Error ? error.message : String(error),
                    agentId: agent.id
                });
                return false;
            }
        });
    }

    async getEntityById(userId: UUID, agentId: UUID): Promise<Entity | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select()
                .from(entityTable)
                .where(and(eq(entityTable.id, userId), eq(entityTable.agentId, agentId)))
                .limit(1);

            if (result.length === 0) return null;

            const account = result[0];

            return account;
        });
    }

    async createEntity(entity: Entity): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                return await this.db.transaction(async (tx) => {
                    await tx.insert(entityTable).values(entity);
    
                    logger.debug("Entity created successfully:", {
                        entity,
                    });
    
                    return true;
                });
            } catch (error) {
                logger.error("Error creating account:", {
                    error: error instanceof Error ? error.message : String(error),
                    accountId: entity.id,
                    name: entity.metadata?.name,
                });
                return false;
            }
        });
    }

    async updateEntity(entity: Entity): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.update(entityTable).set(entity).where(and(eq(entityTable.id, entity.id!), eq(entityTable.agentId, entity.agentId!)));
        });
    }

    async getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId?: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]> {
        if (!params.tableName) throw new Error("tableName is required");
        if (!params.roomId) throw new Error("roomId is required");

        return this.withDatabase(async () => {
            const conditions = [
                eq(memoryTable.type, params.tableName),
                eq(memoryTable.roomId, params.roomId),
            ];

            if (params.start) {
                conditions.push(gte(memoryTable.createdAt, params.start));
            }

            if (params.end) {
                conditions.push(lte(memoryTable.createdAt, params.end));
            }

            if (params.unique) {
                conditions.push(eq(memoryTable.unique, true));
            }

            if (params.agentId) {
                conditions.push(eq(memoryTable.agentId, params.agentId));
            }

            const query = this.db
                .select({
                    memory: {
                        id: memoryTable.id,
                        type: memoryTable.type,
                        createdAt: memoryTable.createdAt,
                        content: memoryTable.content,
                        userId: memoryTable.userId,
                        agentId: memoryTable.agentId,
                        roomId: memoryTable.roomId,
                        unique: memoryTable.unique,
                    },
                    embedding: embeddingTable[this.embeddingDimension],
                })
                .from(memoryTable)
                .leftJoin(
                    embeddingTable,
                    eq(embeddingTable.memoryId, memoryTable.id)
                )
                .where(and(...conditions))
                .orderBy(desc(memoryTable.createdAt));

            const rows = params.count
                ? await query.limit(params.count)
                : await query;

            return rows.map((row) => ({
                id: row.memory.id as UUID,
                type: row.memory.type,
                createdAt: row.memory.createdAt,
                content:
                    typeof row.memory.content === "string"
                        ? JSON.parse(row.memory.content)
                        : row.memory.content,
                userId: row.memory.userId as UUID,
                agentId: row.memory.agentId as UUID,
                roomId: row.memory.roomId as UUID,
                unique: row.memory.unique,
                embedding: row.embedding
                    ? Array.from(row.embedding)
                    : undefined,
            }));
        });
    }

    async getMemoriesByRoomIds(params: {
        roomIds: UUID[];
        agentId?: UUID;
        tableName: string;
        limit?: number;
    }): Promise<Memory[]> {
        return this.withDatabase(async () => {
            if (params.roomIds.length === 0) return [];

            const conditions = [
                eq(memoryTable.type, params.tableName),
                inArray(memoryTable.roomId, params.roomIds),
            ];

            if (params.agentId) {
                conditions.push(eq(memoryTable.agentId, params.agentId));
            }

            const query = this.db
                .select({
                    id: memoryTable.id,
                    type: memoryTable.type,
                    createdAt: memoryTable.createdAt,
                    content: memoryTable.content,
                    userId: memoryTable.userId,
                    agentId: memoryTable.agentId,
                    roomId: memoryTable.roomId,
                    unique: memoryTable.unique,
                })
                .from(memoryTable)
                .where(and(...conditions))
                .orderBy(desc(memoryTable.createdAt));

            const rows = params.limit
                ? await query.limit(params.limit)
                : await query;

            return rows.map((row) => ({
                id: row.id as UUID,
                createdAt: row.createdAt,
                content:
                    typeof row.content === "string"
                        ? JSON.parse(row.content)
                        : row.content,
                userId: row.userId as UUID,
                agentId: row.agentId as UUID,
                roomId: row.roomId as UUID,
                unique: row.unique,
            })) as Memory[];
        });
    }

    async getMemoryById(id: UUID): Promise<Memory | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({
                    memory: memoryTable,
                    embedding: embeddingTable[this.embeddingDimension],
                })
                .from(memoryTable)
                .leftJoin(
                    embeddingTable,
                    eq(memoryTable.id, embeddingTable.memoryId)
                )
                .where(eq(memoryTable.id, id))
                .limit(1);

            if (result.length === 0) return null;

            const row = result[0];
            return {
                id: row.memory.id as UUID,
                createdAt: row.memory.createdAt,
                content:
                    typeof row.memory.content === "string"
                        ? JSON.parse(row.memory.content)
                        : row.memory.content,
                userId: row.memory.userId as UUID,
                agentId: row.memory.agentId as UUID,
                roomId: row.memory.roomId as UUID,
                unique: row.memory.unique,
                embedding: row.embedding ?? undefined,
            };
        });
    }

    async getMemoriesByIds(
        memoryIds: UUID[],
        tableName?: string
    ): Promise<Memory[]> {
        return this.withDatabase(async () => {
            if (memoryIds.length === 0) return [];

            const conditions = [inArray(memoryTable.id, memoryIds)];

            if (tableName) {
                conditions.push(eq(memoryTable.type, tableName));
            }

            const rows = await this.db
                .select({
                    memory: memoryTable,
                    embedding: embeddingTable[this.embeddingDimension],
                })
                .from(memoryTable)
                .leftJoin(
                    embeddingTable,
                    eq(embeddingTable.memoryId, memoryTable.id)
                )
                .where(and(...conditions))
                .orderBy(desc(memoryTable.createdAt));

            return rows.map((row) => ({
                id: row.memory.id as UUID,
                createdAt: row.memory.createdAt,
                content:
                    typeof row.memory.content === "string"
                        ? JSON.parse(row.memory.content)
                        : row.memory.content,
                userId: row.memory.userId as UUID,
                agentId: row.memory.agentId as UUID,
                roomId: row.memory.roomId as UUID,
                unique: row.memory.unique,
                embedding: row.embedding ?? undefined,
            }));
        });
    }

    async getCachedEmbeddings(opts: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number;
    }): Promise<{ embedding: number[]; levenshtein_score: number }[]> {
        return this.withDatabase(async () => {
            try {
                const results = await this.db.execute<{
                    embedding: number[];
                    levenshtein_score: number;
                }>(sql`
                    WITH content_text AS (
                        SELECT
                            m.id,
                            COALESCE(
                                m.content->>${opts.query_field_sub_name},
                                ''
                            ) as content_text
                        FROM memories m
                        WHERE m.type = ${opts.query_table_name}
                            AND m.content->>${opts.query_field_sub_name} IS NOT NULL
                    ),
                    embedded_text AS (
                        SELECT 
                            ct.content_text,
                            COALESCE(
                                e.dim_384,
                                e.dim_512,
                                e.dim_768,
                                e.dim_1024,
                                e.dim_1536,
                                e.dim_3072
                            ) as embedding
                        FROM content_text ct
                        LEFT JOIN embeddings e ON e.memory_id = ct.id
                        WHERE e.memory_id IS NOT NULL
                    )
                    SELECT
                        embedding,
                        levenshtein(${opts.query_input}, content_text) as levenshtein_score
                    FROM embedded_text
                    WHERE levenshtein(${opts.query_input}, content_text) <= ${opts.query_threshold}
                    ORDER BY levenshtein_score
                    LIMIT ${opts.query_match_count}
                `);

                return results.rows
                    .map((row) => ({
                        embedding: Array.isArray(row.embedding)
                            ? row.embedding
                            : typeof row.embedding === "string"
                            ? JSON.parse(row.embedding)
                            : [],
                        levenshtein_score: Number(row.levenshtein_score),
                    }))
                    .filter((row) => Array.isArray(row.embedding));
            } catch (error) {
                logger.error("Error in getCachedEmbeddings:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    tableName: opts.query_table_name,
                    fieldName: opts.query_field_name,
                });
                if (
                    error instanceof Error &&
                    error.message ===
                        "levenshtein argument exceeds maximum length of 255 characters"
                ) {
                    return [];
                }
                throw error;
            }
        });
    }

    async log(params: {
        body: { [key: string]: unknown };
        userId: UUID;
        roomId: UUID;
        type: string;
    }): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx.insert(logTable).values({
                        body: sql`${params.body}::jsonb`,
                        userId: params.userId,
                        roomId: params.roomId,
                        type: params.type,
                    });
                });
            } catch (error) {
                logger.error("Failed to create log entry:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    type: params.type,
                    roomId: params.roomId,
                    userId: params.userId,
                });
                throw error;
            }
        });
    }

    async searchMemories(params: {
        tableName: string;
        agentId: UUID;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        count: number;
        unique: boolean;
    }): Promise<Memory[]> {
        return await this.searchMemoriesByEmbedding(params.embedding, {
            match_threshold: params.match_threshold,
            count: params.count,
            agentId: params.agentId,
            roomId: params.roomId,
            unique: params.unique,
            tableName: params.tableName,
        });
    }

    async updateGoalStatus(params: {
        goalId: UUID;
        status: GoalStatus;
    }): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx
                        .update(goalTable)
                        .set({
                            status: params.status as string,
                        })
                        .where(eq(goalTable.id, params.goalId));
                });
            } catch (error) {
                logger.error("Failed to update goal status:", {
                    goalId: params.goalId,
                    status: params.status,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        });
    }

    async searchMemoriesByEmbedding(
        embedding: number[],
        params: {
            match_threshold?: number;
            count?: number;
            roomId?: UUID;
            agentId?: UUID;
            unique?: boolean;
            tableName: string;
        }
    ): Promise<Memory[]> {
        return this.withDatabase(async () => {
            const cleanVector = embedding.map((n) =>
                Number.isFinite(n) ? Number(n.toFixed(6)) : 0
            );

            const similarity = sql<number>`1 - (${cosineDistance(
                embeddingTable[this.embeddingDimension],
                cleanVector
            )})`;

            const conditions = [eq(memoryTable.type, params.tableName)];

            if (params.unique) {
                conditions.push(eq(memoryTable.unique, true));
            }
            if (params.agentId) {
                conditions.push(eq(memoryTable.agentId, params.agentId));
            }
            if (params.roomId) {
                conditions.push(eq(memoryTable.roomId, params.roomId));
            }

            if (params.match_threshold) {
                conditions.push(gte(similarity, params.match_threshold));
            }

            const results = await this.db
                .select({
                    memory: memoryTable,
                    similarity,
                    embedding: embeddingTable[this.embeddingDimension],
                })
                .from(embeddingTable)
                .innerJoin(
                    memoryTable,
                    eq(memoryTable.id, embeddingTable.memoryId)
                )
                .where(and(...conditions))
                .orderBy(desc(similarity))
                .limit(params.count ?? 10);

            return results.map((row) => ({
                id: row.memory.id as UUID,
                type: row.memory.type,
                createdAt: row.memory.createdAt,
                content:
                    typeof row.memory.content === "string"
                        ? JSON.parse(row.memory.content)
                        : row.memory.content,
                userId: row.memory.userId as UUID,
                agentId: row.memory.agentId as UUID,
                roomId: row.memory.roomId as UUID,
                unique: row.memory.unique,
                embedding: row.embedding ?? undefined,
                similarity: row.similarity,
            }));
        });
    }

    async createMemory(memory: Memory, tableName: string): Promise<void> {
        logger.debug("DrizzleAdapter createMemory:", {
            memoryId: memory.id,
            embeddingLength: memory.embedding?.length,
            contentLength: memory.content?.text?.length,
        });

        let isUnique = true;
        if (memory.embedding && Array.isArray(memory.embedding)) {
            logger.info("Searching for similar memories:");
            const similarMemories = await this.searchMemoriesByEmbedding(
                memory.embedding,
                {
                    tableName,
                    roomId: memory.roomId,
                    match_threshold: 0.95,
                    count: 1,
                }
            );
            isUnique = similarMemories.length === 0;
        }

        const contentToInsert =
            typeof memory.content === "string"
                ? JSON.parse(memory.content)
                : memory.content;

        const memoryId = memory.id ?? v4();

        await this.db.transaction(async (tx) => {
            await tx.insert(memoryTable).values([
                {
                    id: memoryId,
                    type: tableName,
                    content: sql`${contentToInsert}::jsonb`,
                    userId: memory.userId,
                    roomId: memory.roomId,
                    agentId: memory.agentId,
                    unique: memory.unique ?? isUnique,
                    createdAt: memory.createdAt,
                },
            ]);

            if (memory.embedding && Array.isArray(memory.embedding)) {
                const embeddingValues: Record<string, unknown> = {
                    id: v4(),
                    memoryId: memoryId,
                    createdAt: memory.createdAt,
                };

                const cleanVector = memory.embedding.map((n) =>
                    Number.isFinite(n) ? Number(n.toFixed(6)) : 0
                );

                embeddingValues[this.embeddingDimension] = cleanVector;

                await tx.insert(embeddingTable).values([embeddingValues]);
            }
        });

        logger.info("Memory created successfully:", {
            memoryId,
            hasEmbedding: !!memory.embedding,
        });
    }

    async removeMemory(memoryId: UUID, tableName: string): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.transaction(async (tx) => {
                await tx
                    .delete(embeddingTable)
                    .where(eq(embeddingTable.memoryId, memoryId));

                await tx
                    .delete(memoryTable)
                    .where(
                        and(
                            eq(memoryTable.id, memoryId),
                            eq(memoryTable.type, tableName)
                        )
                    );
            });

            logger.debug("Memory removed successfully:", {
                memoryId,
                tableName,
            });
        });
    }

    async removeAllMemories(roomId: UUID, tableName: string): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.transaction(async (tx) => {
                const memoryIds = await tx
                    .select({ id: memoryTable.id })
                    .from(memoryTable)
                    .where(
                        and(
                            eq(memoryTable.roomId, roomId),
                            eq(memoryTable.type, tableName)
                        )
                    );

                if (memoryIds.length > 0) {
                    await tx.delete(embeddingTable).where(
                        inArray(
                            embeddingTable.memoryId,
                            memoryIds.map((m) => m.id)
                        )
                    );

                    await tx
                        .delete(memoryTable)
                        .where(
                            and(
                                eq(memoryTable.roomId, roomId),
                                eq(memoryTable.type, tableName)
                            )
                        );
                }
            });

            logger.debug("All memories removed successfully:", {
                roomId,
                tableName,
            });
        });
    }

    async countMemories(
        roomId: UUID,
        unique = true,
        tableName = ""
    ): Promise<number> {
        if (!tableName) throw new Error("tableName is required");

        return this.withDatabase(async () => {
            const conditions = [
                eq(memoryTable.roomId, roomId),
                eq(memoryTable.type, tableName),
            ];

            if (unique) {
                conditions.push(eq(memoryTable.unique, true));
            }

            const result = await this.db
                .select({ count: sql<number>`count(*)` })
                .from(memoryTable)
                .where(and(...conditions));

            return Number(result[0]?.count ?? 0);
        });
    }

    async getGoals(params: {
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]> {
        return this.withDatabase(async () => {
            const conditions = [eq(goalTable.roomId, params.roomId)];

            if (params.userId) {
                conditions.push(eq(goalTable.userId, params.userId));
            }

            if (params.onlyInProgress) {
                conditions.push(
                    eq(goalTable.status, "IN_PROGRESS" as GoalStatus)
                );
            }

            const query = this.db
                .select()
                .from(goalTable)
                .where(and(...conditions))
                .orderBy(desc(goalTable.createdAt));

            const result = await (params.count
                ? query.limit(params.count)
                : query);

            return result.map((row) => ({
                id: row.id as UUID,
                roomId: row.roomId as UUID,
                userId: row.userId as UUID,
                name: row.name ?? "",
                status: (row.status ?? "NOT_STARTED") as GoalStatus,
                description: row.description ?? "",
                objectives: row.objectives as any[],
                createdAt: row.createdAt,
            }));
        });
    }

    async updateGoal(goal: Goal): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx
                        .update(goalTable)
                        .set({
                            name: goal.name,
                            status: goal.status,
                            objectives: goal.objectives,
                        })
                        .where(eq(goalTable.id, goal.id as string));
                });
            } catch (error) {
                logger.error("Failed to update goal:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    goalId: goal.id,
                    status: goal.status,
                });
                throw error;
            }
        });
    }

    async createGoal(goal: Goal): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx.insert(goalTable).values({
                        id: goal.id ?? v4(),
                        roomId: goal.roomId,
                        userId: goal.userId,
                        name: goal.name,
                        status: goal.status,
                        objectives: sql`${goal.objectives}::jsonb`,
                    });
                });
            } catch (error) {
                logger.error("Failed to update goal:", {
                    goalId: goal.id,
                    error: error instanceof Error ? error.message : String(error),
                    status: goal.status,
                });
                throw error;
            }
        });
    }

    async removeGoal(goalId: UUID): Promise<void> {
        if (!goalId) throw new Error("Goal ID is required");
    
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx.delete(goalTable).where(eq(goalTable.id, goalId));
                });
    
                logger.debug("Goal removal attempt:", {
                    goalId,
                    removed: true,
                });
            } catch (error) {
                logger.error("Failed to remove goal:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    goalId,
                });
                throw error;
            }
        });
    }

    async removeAllGoals(roomId: UUID): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.transaction(async (tx) => {
                await tx.delete(goalTable).where(eq(goalTable.roomId, roomId));
            });
        });
    }

    async getRoom(roomId: UUID, agentId: UUID): Promise<RoomData | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({
                    id: roomTable.id as any,
                    channelId: roomTable.channelId as any,
                    agentId: roomTable.agentId as any,
                    serverId: roomTable.serverId as any,
                    type: roomTable.type as any,
                    source: roomTable.source as any,
                })
                .from(roomTable)
                .where(and(eq(roomTable.id, roomId), eq(roomTable.agentId, agentId)))
                .limit(1);
            if (result.length === 0) return null;
            return result[0]
        });
    }

    async updateRoom(room: RoomData): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.update(roomTable).set(room).where(eq(roomTable.id, room.id));
        });
    }

    async createRoom({id, name, agentId, source, type, channelId, serverId, worldId}: RoomData): Promise<UUID> {
        return this.withDatabase(async () => {
            const newRoomId = id || v4();
            await this.db.insert(roomTable).values({
                id: newRoomId,
                name,
                agentId: agentId as UUID,
                source,
                type,
                channelId,
                serverId,
                worldId,
            })
            .onConflictDoNothing({ target: roomTable.id });
            return newRoomId as UUID;
        });
    }

    async removeRoom(roomId: UUID): Promise<void> {
        if (!roomId) throw new Error("Room ID is required");
        return this.withDatabase(async () => {
            await this.db.transaction(async (tx) => {
                await tx.delete(roomTable).where(eq(roomTable.id, roomId));
            });
        });
    }

    async getRoomsForParticipant(userId: UUID): Promise<UUID[]> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({ roomId: participantTable.roomId })
                .from(participantTable)
                .where(eq(participantTable.userId, userId));

            return result.map((row) => row.roomId as UUID);
        });
    }

    async getRoomsForParticipants(userIds: UUID[], agentId: UUID): Promise<UUID[]> {
        return this.withDatabase(async () => {
            const result = await this.db
                .selectDistinct({ roomId: participantTable.roomId })
                .from(participantTable)
                .innerJoin(roomTable, eq(participantTable.roomId, roomTable.id))
                .where(
                    and(
                        inArray(participantTable.userId, userIds),
                        eq(roomTable.agentId, agentId)
                    )
                );

            return result.map((row) => row.roomId as UUID);
        });
    }

    async addParticipant(userId: UUID, roomId: UUID, agentId: UUID): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx.insert(participantTable).values({
                        id: v4(),
                        userId,
                        roomId,
                        agentId
                    });
                });
                return true;
            } catch (error) {
                logger.error("Failed to add participant:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    userId,
                    roomId,
                });
                return false;
            }
        });
    }

    async removeParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                const result = await this.db.transaction(async (tx) => {
                    return await tx
                        .delete(participantTable)
                        .where(
                            and(
                                eq(participantTable.userId, userId),
                                eq(participantTable.roomId, roomId)
                            )
                        )
                        .returning();
                });
                
                const removed = result.length > 0;
                
                logger.debug(`Participant ${removed ? 'removed' : 'not found'}:`, {
                    userId,
                    roomId,
                    removed,
                });
                
                return removed;
            } catch (error) {
                logger.error("Failed to remove participant:", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    userId,
                    roomId,
                });
                return false;
            }
        });
    }

    async getParticipantsForAccount(userId: UUID, agentId: UUID): Promise<Participant[]> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({
                    id: participantTable.id,
                    userId: participantTable.userId,
                    roomId: participantTable.roomId,
                })
                .from(participantTable)
                .where(eq(participantTable.userId, userId));

            const account = await this.getEntityById(userId, agentId);

            return result.map((row) => ({
                id: row.id as UUID,
                account: account!,
            }));
        });
    }

    async getParticipantsForRoom(roomId: UUID, agentId: UUID): Promise<UUID[]> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({ userId: participantTable.userId })
                .from(participantTable)
                .where(
                    and(
                        eq(participantTable.roomId, roomId),
                        eq(participantTable.agentId, agentId)
                    )
                );

            return result.map((row) => row.id as UUID);
        });
    }

    async getParticipantUserState(
        roomId: UUID,
        userId: UUID,
        agentId: UUID
    ): Promise<"FOLLOWED" | "MUTED" | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select({ roomState: participantTable.roomState })
                .from(participantTable)
                .where(
                    and(
                        eq(participantTable.roomId, roomId),
                        eq(participantTable.userId, userId),
                        eq(participantTable.agentId, agentId)
                    )
                )
                .limit(1);

            return (
                (result[0]?.roomState as "FOLLOWED" | "MUTED" | null) ?? null
            );
        });
    }

    async setParticipantUserState(
        roomId: UUID,
        userId: UUID,
        agentId: UUID,
        state: "FOLLOWED" | "MUTED" | null
    ): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx
                        .update(participantTable)
                        .set({ roomState: state })
                        .where(
                            and(
                                eq(participantTable.roomId, roomId),
                                eq(participantTable.userId, userId),
                                eq(participantTable.agentId, agentId)
                            )
                        );
                });
            } catch (error) {
                logger.error("Failed to set participant user state:", {
                    roomId,
                    userId,
                    state,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        });
    }

    async createRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<boolean> {
        if (!params.userA || !params.userB) {
            throw new Error("userA and userB are required");
        }
    
        return this.withDatabase(async () => {
            try {
                return await this.db.transaction(async (tx) => {
                    const relationshipId = v4();
                    await tx.insert(relationshipTable).values({
                        id: relationshipId,
                        userA: params.userA,
                        userB: params.userB,
                        userId: params.userA,
                    });
    
                    logger.debug("Relationship created successfully:", {
                        relationshipId,
                        userA: params.userA,
                        userB: params.userB,
                    });
    
                    return true;
                });
            } catch (error) {
                if ((error as { code?: string }).code === "23505") {
                    logger.warn("Relationship already exists:", {
                        userA: params.userA,
                        userB: params.userB,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                } else {
                    logger.error("Failed to create relationship:", {
                        userA: params.userA,
                        userB: params.userB,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                }
                return false;
            }
        });
    }

    async getRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<Relationship | null> {
        if (!params.userA || !params.userB) {
            throw new Error("userA and userB are required");
        }

        return this.withDatabase(async () => {
            try {
                const result = await this.db
                    .select()
                    .from(relationshipTable)
                    .where(
                        or(
                            and(
                                eq(relationshipTable.userA, params.userA),
                                eq(relationshipTable.userB, params.userB)
                            ),
                            and(
                                eq(relationshipTable.userA, params.userB),
                                eq(relationshipTable.userB, params.userA)
                            )
                        )
                    )
                    .limit(1);

                if (result.length > 0) {
                    return result[0] as unknown as Relationship;
                }

                logger.debug("No relationship found between users:", {
                    userA: params.userA,
                    userB: params.userB,
                });
                return null;
            } catch (error) {
                logger.error("Error fetching relationship:", {
                    userA: params.userA,
                    userB: params.userB,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        });
    }

    async getRelationships(params: { userId: UUID }): Promise<Relationship[]> {
        if (!params.userId) {
            throw new Error("userId is required");
        }
        return this.withDatabase(async () => {
            try {
                const result = await this.db
                    .select()
                    .from(relationshipTable)
                    .where(
                        or(
                            eq(relationshipTable.userA, params.userId),
                            eq(relationshipTable.userB, params.userId)
                        )
                    )
                    .orderBy(desc(relationshipTable.createdAt));

                logger.debug("Retrieved relationships:", {
                    userId: params.userId,
                    count: result.length,
                });

                return result as unknown as Relationship[];
            } catch (error) {
                logger.error("Failed to fetch relationships:", {
                    userId: params.userId,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        });
    }

    async getCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<string | undefined> {
        return this.withDatabase(async () => {
            try {
                const result = await this.db
                    .select()
                    .from(cacheTable)
                    .where(
                        and(
                            eq(cacheTable.agentId, params.agentId),
                            eq(cacheTable.key, params.key)
                        )
                    );

                return result[0]?.value || undefined;
            } catch (error) {
                logger.error("Error fetching cache", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    key: params.key,
                    agentId: params.agentId,
                });
                return undefined;
            }
        });
    }

    async setCache(params: {
        agentId: UUID;
        key: string;
        value: string;
    }): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx
                        .insert(cacheTable)
                        .values({
                            key: params.key,
                            agentId: params.agentId,
                            value: sql`${params.value}::jsonb`,
                        })
                        .onConflictDoUpdate({
                            target: [cacheTable.key, cacheTable.agentId],
                            set: {
                                value: params.value,
                            },
                        });
                });
                return true;
            } catch (error) {
                logger.error("Error setting cache", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    key: params.key,
                    agentId: params.agentId,
                });
                return false;
            }
        });
    }

    async deleteCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<boolean> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    await tx
                        .delete(cacheTable)
                        .where(
                            and(
                                eq(cacheTable.agentId, params.agentId),
                                eq(cacheTable.key, params.key)
                            )
                        );
                });
                return true;
            } catch (error) {
                logger.error("Error deleting cache", {
                    error:
                        error instanceof Error ? error.message : String(error),
                    key: params.key,
                    agentId: params.agentId,
                });
                return false;
            }
        });
    }
    async createCharacter(character: Character): Promise<UUID | void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    const insertData = characterToInsert({ ...character });
                    await tx.insert(characterTable).values(insertData);
                    return character.id;
                });
    
                logger.debug("Character created successfully:", {
                    name: character.name,
                });

                return character.id;
            } catch (error) {
                logger.error("Failed to create character:", {
                    error: error instanceof Error ? error.message : String(error),
                    characterName: character.name,
                });
                throw error;
            }
        });
    }

    async listCharacters(): Promise<Character[]> {
        return this.withDatabase(async () => {
            const characters = await this.db
                .select()
                .from(characterTable)
                .orderBy(desc(characterTable.createdAt));

            return characters.map((char) => ({
                name: char.name,
                username: char.username ?? undefined,
                system: char.system ?? undefined,
                templates: char.templates
                    ? Object.fromEntries(
                          Object.entries(char.templates).map(
                              ([key, stored]) => [
                                  key,
                                  storedToTemplate(stored as StoredTemplate),
                              ]
                          )
                      )
                    : undefined,
                bio: char.bio,
                messageExamples: char.messageExamples || undefined,
                postExamples: char.postExamples || undefined,
                topics: char.topics || undefined,
                adjectives: char.adjectives || undefined,
                knowledge: char.knowledge || undefined,
                plugins: char.plugins || undefined,
                settings: char.settings || undefined,
                style: char.style || undefined,
            }));
        });
    }

    async getCharacter(name: string): Promise<Character | null> {
        return this.withDatabase(async () => {
            const result = await this.db
                .select()
                .from(characterTable)
                .where(eq(characterTable.name, name))
                .limit(1);

            if (result.length === 0) return null;

            const char = result[0];
            return {
                name: char.name,
                username: char.username ?? undefined,
                system: char.system ?? undefined,
                templates: char.templates
                    ? Object.fromEntries(
                          Object.entries(char.templates).map(
                              ([key, stored]) => [
                                  key,
                                  storedToTemplate(stored as StoredTemplate),
                              ]
                          )
                      )
                    : undefined,
                bio: char.bio,
                messageExamples: char.messageExamples || undefined,
                postExamples: char.postExamples || undefined,
                topics: char.topics || undefined,
                adjectives: char.adjectives || undefined,
                knowledge: char.knowledge || undefined,
                plugins: char.plugins || undefined,
                settings: char.settings || undefined,
                style: char.style || undefined,
            };
        });
    }

    async updateCharacter(
        name: string,
        updates: Partial<Character>
    ): Promise<void> {
        return this.withDatabase(async () => {
            try {
                await this.db.transaction(async (tx) => {
                    const { templates, ...restUpdates } = updates;
    
                    const updateData: Partial<typeof characterTable.$inferInsert> = {
                        ...restUpdates,
                        ...(templates && {
                            templates: Object.fromEntries(
                                Object.entries(templates).map(([key, value]) => [
                                    key,
                                    templateToStored(value),
                                ])
                            ),
                        }),
                    };
    
                    await tx
                        .update(characterTable)
                        .set(updateData)
                        .where(eq(characterTable.name, name));
                });
    
                logger.debug("Character updated successfully:", {
                    name,
                    updatedFields: Object.keys(updates),
                });
            } catch (error) {
                logger.error("Failed to update character:", {
                    name,
                    error: error instanceof Error ? error.message : String(error),
                    updatedFields: Object.keys(updates),
                });
                throw error;
            }
        });
    }

    async removeCharacter(name: string): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.transaction(async (tx) => {
                await tx
                    .delete(characterTable)
                    .where(eq(characterTable.name, name));

                logger.debug("Character removed successfully:", { name });
            });
        });
    }

    async createWorld(world: WorldData): Promise<UUID> {
        return this.withDatabase(async () => {
            const newWorldId = world.id || v4();
            await this.db.insert(worldTable).values({
                ...world,
                id: newWorldId,
            });
            return newWorldId;
        });
    }
    
    async getWorld(id: UUID): Promise<WorldData | null> {
        return this.withDatabase(async () => {
            const result = await this.db.select().from(worldTable).where(eq(worldTable.id, id));
            return result[0] as WorldData | null;
        });
    }

    async updateWorld(world: WorldData): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.update(worldTable).set(world).where(eq(worldTable.id, world.id));
        });
    }

    async removeWorld(id: UUID): Promise<void> {
        return this.withDatabase(async () => {
            await this.db.delete(worldTable).where(eq(worldTable.id, id));
        });
    }
}
