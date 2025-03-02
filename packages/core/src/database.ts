import type {
    Agent,
    Character,
    Component,
    Entity,
    Goal,
    GoalStatus,
    IDatabaseAdapter,
    Memory,
    Participant,
    Relationship,
    RoomData,
    UUID,
    WorldData
} from "./types.ts";

/**
 * An abstract class representing a database adapter for managing various entities
 * like entities, memories, actors, goals, and rooms.
 */
export abstract class DatabaseAdapter<DB = any> implements IDatabaseAdapter {
    /**
     * The database instance.
     */
    db: DB;

    /**
     * Optional initialization method for the database adapter.
     * @returns A Promise that resolves when initialization is complete.
     */
    abstract init(): Promise<void>;

    /**
     * Optional close method for the database adapter.
     * @returns A Promise that resolves when closing is complete.
     */
    abstract close(): Promise<void>;

    /**
     * Retrieves an account by its ID.
     * @param userId The UUID of the user account to retrieve.
     * @returns A Promise that resolves to the Entity object or null if not found.
     */
    abstract getEntityById(userId: UUID): Promise<Entity | null>;

    abstract getEntitiesForRoom(roomId: UUID, includeComponents?: boolean): Promise<Entity[]>;

    abstract getAgent(agentId: UUID): Promise<Agent | null>;

    abstract createAgent(agent: Agent): Promise<boolean>;

    abstract updateAgent(agent: Agent): Promise<boolean>;

    /**
     * Creates a new account in the database.
     * @param account The account object to create.
     * @returns A Promise that resolves when the account creation is complete.
     */
    abstract createEntity(entity: Entity): Promise<boolean>;

    /**
     * Updates an existing account in the database.
     * @param account The account object with updated properties.
     * @returns A Promise that resolves when the account update is complete.
     */
    abstract updateEntity(entity: Entity): Promise<void>;

    /**
     * Retrieves a single component by entity ID and type.
     * @param entityId The UUID of the entity the component belongs to
     * @param type The type identifier for the component
     * @param worldId Optional UUID of the world the component belongs to
     * @param sourceEntityId Optional UUID of the source entity
     * @returns Promise resolving to the Component if found, null otherwise
     */
    abstract getComponent(entityId: UUID, type: string, worldId?: UUID, sourceEntityId?: UUID): Promise<Component | null>;

    /**
     * Retrieves all components for an entity.
     * @param entityId The UUID of the entity to get components for
     * @param worldId Optional UUID of the world to filter components by
     * @param sourceEntityId Optional UUID of the source entity to filter by
     * @returns Promise resolving to array of Component objects
     */
    abstract getComponents(entityId: UUID, worldId?: UUID, sourceEntityId?: UUID): Promise<Component[]>;

    /**
     * Creates a new component in the database.
     * @param component The component object to create
     * @returns Promise resolving to true if creation was successful
     */
    abstract createComponent(component: Component): Promise<boolean>;

    /**
     * Updates an existing component in the database.
     * @param component The component object with updated properties
     * @returns Promise that resolves when the update is complete
     */
    abstract updateComponent(component: Component): Promise<void>;

    /**
     * Deletes a component from the database.
     * @param componentId The UUID of the component to delete
     * @returns Promise that resolves when the deletion is complete
     */
    abstract deleteComponent(componentId: UUID): Promise<void>;
    
    /**
     * Retrieves memories based on the specified parameters.
     * @param params An object containing parameters for the memory retrieval.
     * @returns A Promise that resolves to an array of Memory objects.
     */
    abstract getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;

    abstract getMemoriesByRoomIds(params: {
        roomIds: UUID[];
        tableName: string;
        limit?: number;
    }): Promise<Memory[]>;

    abstract getMemoryById(id: UUID): Promise<Memory | null>;

    /**
     * Retrieves multiple memories by their IDs
     * @param memoryIds Array of UUIDs of the memories to retrieve
     * @param tableName Optional table name to filter memories by type
     * @returns Promise resolving to array of Memory objects
     */
    abstract getMemoriesByIds(
        memoryIds: UUID[],
        tableName?: string
    ): Promise<Memory[]>;

    /**
     * Retrieves cached embeddings based on the specified query parameters.
     * @param params An object containing parameters for the embedding retrieval.
     * @returns A Promise that resolves to an array of objects containing embeddings and levenshtein scores.
     */
    abstract getCachedEmbeddings({
        query_table_name,
        query_threshold,
        query_input,
        query_field_name,
        query_field_sub_name,
        query_match_count,
    }: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number;
    }): Promise<
        {
            embedding: number[];
            levenshtein_score: number;
        }[]
    >;

    /**
     * Logs an event or action with the specified details.
     * @param params An object containing parameters for the log entry.
     * @returns A Promise that resolves when the log entry has been saved.
     */
    abstract log(params: {
        body: { [key: string]: unknown };
        userId: UUID;
        roomId: UUID;
        type: string;
    }): Promise<void>;

    /**
     * Searches for memories based on embeddings and other specified parameters.
     * @param params An object containing parameters for the memory search.
     * @returns A Promise that resolves to an array of Memory objects.
     */
    abstract searchMemories(params: {
        tableName: string;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        count: number;
        unique: boolean;
    }): Promise<Memory[]>;

    /**
     * Updates the status of a specific goal.
     * @param params An object containing the goalId and the new status.
     * @returns A Promise that resolves when the goal status has been updated.
     */
    abstract updateGoalStatus(params: {
        goalId: UUID;
        status: GoalStatus;
    }): Promise<void>;

    /**
     * Creates a new memory in the database.
     * @param memory The memory object to create.
     * @param tableName The table where the memory should be stored.
     * @param unique Indicates if the memory should be unique.
     * @returns A Promise that resolves when the memory has been created.
     */
    abstract createMemory(
        memory: Memory,
        tableName: string,
        unique?: boolean
    ): Promise<UUID>;

    /**
     * Removes a specific memory from the database.
     * @param memoryId The UUID of the memory to remove.
     * @param tableName The table from which the memory should be removed.
     * @returns A Promise that resolves when the memory has been removed.
     */
    abstract removeMemory(memoryId: UUID, tableName: string): Promise<void>;

    /**
     * Removes all memories associated with a specific room.
     * @param roomId The UUID of the room whose memories should be removed.
     * @param tableName The table from which the memories should be removed.
     * @returns A Promise that resolves when all memories have been removed.
     */
    abstract removeAllMemories(roomId: UUID, tableName: string): Promise<void>;

    /**
     * Counts the number of memories in a specific room.
     * @param roomId The UUID of the room for which to count memories.
     * @param unique Specifies whether to count only unique memories.
     * @param tableName Optional table name to count memories from.
     * @returns A Promise that resolves to the number of memories.
     */
    abstract countMemories(
        roomId: UUID,
        unique?: boolean,
        tableName?: string
    ): Promise<number>;

    /**
     * Retrieves goals based on specified parameters.
     * @param params An object containing parameters for goal retrieval.
     * @returns A Promise that resolves to an array of Goal objects.
     */
    abstract getGoals(params: {
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]>;

    /**
     * Updates a specific goal in the database.
     * @param goal The goal object with updated properties.
     * @returns A Promise that resolves when the goal has been updated.
     */
    abstract updateGoal(goal: Goal): Promise<void>;

    /**
     * Creates a new goal in the database.
     * @param goal The goal object to create.
     * @returns A Promise that resolves when the goal has been created.
     */
    abstract createGoal(goal: Goal): Promise<void>;

    /**
     * Removes a specific goal from the database.
     * @param goalId The UUID of the goal to remove.
     * @returns A Promise that resolves when the goal has been removed.
     */
    abstract removeGoal(goalId: UUID): Promise<void>;

    /**
     * Removes all goals associated with a specific room.
     * @param roomId The UUID of the room whose goals should be removed.
     * @returns A Promise that resolves when all goals have been removed.
     */
    abstract removeAllGoals(roomId: UUID): Promise<void>;

    /**
     * Retrieves a world by its ID.
     * @param id The UUID of the world to retrieve.
     * @returns A Promise that resolves to the WorldData object or null if not found.
     */
    abstract getWorld(id: UUID): Promise<WorldData | null>;

    /**
     * Retrieves all worlds for an agent.
     * @returns A Promise that resolves to an array of WorldData objects.
     */
    abstract getAllWorlds(): Promise<WorldData[]>;

    /**
     * Creates a new world in the database.
     * @param world The world object to create.
     * @returns A Promise that resolves to the UUID of the created world.
     */
    abstract createWorld(world: WorldData): Promise<UUID>;

    /**
     * Updates an existing world in the database.
     * @param world The world object with updated properties.
     * @returns A Promise that resolves when the world has been updated.
     */
    abstract updateWorld(world: WorldData): Promise<void>;

    /**
     * Removes a specific world from the database.
     * @param id The UUID of the world to remove.
     * @returns A Promise that resolves when the world has been removed.
     */
    abstract removeWorld(id: UUID): Promise<void>;

    /**
     * Retrieves the room ID for a given room, if it exists.
     * @param roomId The UUID of the room to retrieve.
     * @returns A Promise that resolves to the room ID or null if not found.
     */
    abstract getRoom(roomId: UUID): Promise<RoomData | null>;

    /**
     * Retrieves all rooms for a given world.
     * @param worldId The UUID of the world to retrieve rooms for.
     * @returns A Promise that resolves to an array of Room objects.
     */
    abstract getRooms(worldId: UUID): Promise<RoomData[]>;

    /**
     * Creates a new room with an optional specified ID.
     * @param roomId Optional UUID to assign to the new room.
     * @returns A Promise that resolves to the UUID of the created room.
     */
    abstract createRoom({id, source, type, channelId, serverId, worldId}: RoomData): Promise<UUID>;

    /**
     * Updates a specific room in the database.
     * @param room The room object with updated properties.
     * @returns A Promise that resolves when the room has been updated.
     */
    abstract updateRoom(room: RoomData): Promise<void>;

    /**
     * Removes a specific room from the database.
     * @param roomId The UUID of the room to remove.
     * @returns A Promise that resolves when the room has been removed.
     */
    abstract removeRoom(roomId: UUID): Promise<void>;

    /**
     * Retrieves room IDs for which a specific user is a participant.
     * @param userId The UUID of the user.
     * @returns A Promise that resolves to an array of room IDs.
     */
    abstract getRoomsForParticipant(userId: UUID): Promise<UUID[]>;

    /**
     * Retrieves room IDs for which specific users are participants.
     * @param userIds An array of UUIDs of the users.
     * @returns A Promise that resolves to an array of room IDs.
     */
    abstract getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;

    /**
     * Adds a user as a participant to a specific room.
     * @param userId The UUID of the user to add as a participant.
     * @param roomId The UUID of the room to which the user will be added.
     * @returns A Promise that resolves to a boolean indicating success or failure.
     */
    abstract addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

    /**
     * Removes a user as a participant from a specific room.
     * @param userId The UUID of the user to remove as a participant.
     * @param roomId The UUID of the room from which the user will be removed.
     * @returns A Promise that resolves to a boolean indicating success or failure.
     */
    abstract removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

    /**
     * Retrieves participants associated with a specific account.
     * @param userId The UUID of the account.
     * @returns A Promise that resolves to an array of Participant objects.
     */
    abstract getParticipantsForAccount(userId: UUID): Promise<Participant[]>;

    /**
     * Retrieves participants for a specific room.
     * @param roomId The UUID of the room for which to retrieve participants.
     * @returns A Promise that resolves to an array of UUIDs representing the participants.
     */
    abstract getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;

    abstract getParticipantUserState(
        roomId: UUID,
        userId: UUID,
    ): Promise<"FOLLOWED" | "MUTED" | null>;

    abstract setParticipantUserState(
        roomId: UUID,
        userId: UUID,
        state: "FOLLOWED" | "MUTED" | null
    ): Promise<void>;

    /**
     * Creates a new relationship between two users.
     * @param params Object containing the relationship details including entity IDs, agent ID, optional tags and metadata
     * @returns A Promise that resolves to a boolean indicating success or failure of the creation.
     */
    abstract createRelationship(params: {
        sourceEntityId: UUID;
        targetEntityId: UUID;
        tags?: string[];
        metadata?: { [key: string]: any };
    }): Promise<boolean>;

    /**
     * Retrieves a relationship between two users if it exists.
     * @param params Object containing the entity IDs and agent ID
     * @returns A Promise that resolves to the Relationship object or null if not found.
     */
    abstract getRelationship(params: {
        sourceEntityId: UUID;
        targetEntityId: UUID;
    }): Promise<Relationship | null>;

    /**
     * Retrieves all relationships for a specific user.
     * @param params Object containing the user ID, agent ID and optional tags to filter by
     * @returns A Promise that resolves to an array of Relationship objects.
     */
    abstract getRelationships(params: {
        userId: UUID;
        tags?: string[];
    }): Promise<Relationship[]>;

    /**
     * Updates an existing relationship between two users.
     * @param params Object containing the relationship details to update including entity IDs, agent ID, optional tags and metadata
     * @returns A Promise that resolves to a boolean indicating success or failure of the update.
     */
    abstract updateRelationship(params: {
        sourceEntityId: UUID;
        targetEntityId: UUID;
        tags?: string[];
        metadata?: { [key: string]: any };
    }): Promise<void>;

    /**
     * Creates a new character in the database.
     * @param character The Character object to create.
     * @returns A Promise that resolves when the character creation is complete.
     */
    abstract createCharacter(character: Character): Promise<UUID | undefined>;

    /**
     * Retrieves all characters from the database.
     * @returns A Promise that resolves to an array of Character objects.
     */
    abstract listCharacters(): Promise<Character[]>;

    /**
     * Retrieves a character by their name.
     * @param name The name of the character to retrieve.
     * @returns A Promise that resolves to the Character object or null if not found.
     */
    abstract getCharacter(name: string): Promise<Character | null>;

    /**
     * Updates an existing character in the database.
     * @param name The name of the character to update.
     * @param updates Partial Character object containing the fields to update.
     * @returns A Promise that resolves when the character update is complete.
     */
    abstract updateCharacter(name: string, updates: Partial<Character>): Promise<void>;

    /**
     * Removes a character from the database.
     * @param name The name of the character to remove.
     * @returns A Promise that resolves when the character removal is complete.
     */
    abstract removeCharacter(name: string): Promise<void>;

    /**
     * Ensures the embedding dimension is properly set for the database.
     * @param dimension The dimension number to ensure.
     * @returns void
     */
    abstract ensureEmbeddingDimension(dimension: number): void;

    /**
     * Retrieves a cached value by key from the database.
     * @param key The key to look up in the cache
     * @returns Promise resolving to the cached string value
     */
    abstract getCache(key: string): Promise<string | undefined>;

    /**
     * Sets a value in the cache with the given key.
     * @param params Object containing the cache key and value
     * @param key The key to store the value under
     * @param value The string value to cache
     * @returns Promise resolving to true if the cache was set successfully
     */
    abstract setCache(key: string, value: string): Promise<boolean>;

    /**
     * Deletes a value from the cache by key.
     * @param key The key to delete from the cache
     * @returns Promise resolving to true if the value was successfully deleted
     */
    abstract deleteCache(key: string): Promise<boolean>;
}
