import { logger, stringToUuid } from "./index.ts";
import { parseJSONObjectFromText } from "./prompts";
import { composePrompt } from "./prompts.ts";
import {
  type Entity,
  type IAgentRuntime,
  type Memory,
  ModelTypes,
  type Relationship,
  type State,
  type UUID
} from "./types.ts";

const entityResolutionTemplate = `# Task: Resolve Entity Name
Message Sender: {{senderName}} (ID: {{senderId}})
Agent: {{agentName}} (ID: {{agentId}})

# Entities in Room:
{{#if entitiesInRoom}}
{{entitiesInRoom}}
{{/if}}

{{recentMessages}}

# Instructions:
1. Analyze the context to identify which entity is being referenced
2. Consider special references like "me" (the message sender) or "you" (agent the message is directed to)
3. Look for usernames/handles in standard formats (e.g. @username, user#1234)
4. Consider context from recent messages for pronouns and references
5. If multiple matches exist, use context to disambiguate
6. Consider recent interactions and relationship strength when resolving ambiguity

Return a JSON object with:
\`\`\`json
{
  "entityId": "exact-id-if-known-otherwise-null",
  "type": "EXACT_MATCH | USERNAME_MATCH | NAME_MATCH | RELATIONSHIP_MATCH | AMBIGUOUS | UNKNOWN",
  "matches": [{
    "name": "matched-name",
    "reason": "why this entity matches"
  }]
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.
`;

async function getRecentInteractions(
  runtime: IAgentRuntime,
  sourceEntityId: UUID,
  candidateEntities: Entity[],
  roomId: UUID,
  relationships: Relationship[]
): Promise<{ entity: Entity; interactions: Memory[]; count: number }[]> {
  const results = [];

  // Get recent messages from the room - just for context
  const recentMessages = await runtime.getMemoryManager("messages").getMemories({
    roomId,
    count: 20 // Reduced from 100 since we only need context
  });

  for (const entity of candidateEntities) {
    const interactions: Memory[] = [];
    let interactionScore = 0;

    // First get direct replies using inReplyTo
    const directReplies = recentMessages.filter(msg => 
      (msg.entityId === sourceEntityId && msg.content.inReplyTo === entity.id) ||
      (msg.entityId === entity.id && msg.content.inReplyTo === sourceEntityId)
    );
    
    interactions.push(...directReplies);

    // Get relationship strength from metadata
    const relationship = relationships.find(rel => 
      (rel.sourceEntityId === sourceEntityId && rel.targetEntityId === entity.id) ||
      (rel.targetEntityId === sourceEntityId && rel.sourceEntityId === entity.id)
    );

    if (relationship?.metadata?.interactions) {
      interactionScore = relationship.metadata.interactions;
    }

    // Add bonus points for recent direct replies
    interactionScore += directReplies.length;

    // Keep last few messages for context
    const uniqueInteractions = [...new Set(interactions)];
    results.push({
      entity,
      interactions: uniqueInteractions.slice(-5), // Only keep last 5 messages for context
      count: Math.round(interactionScore)
    });
  }

  // Sort by interaction score descending
  return results.sort((a, b) => b.count - a.count);
}

export async function findEntityByName(
  runtime: IAgentRuntime,
  message: Memory,
  state: State,
): Promise<Entity | null> {
  try {
    const room = await runtime.databaseAdapter.getRoom(message.roomId);
    if (!room) {
      logger.warn("Room not found for entity search");
      return null;
    }

    const world = room.worldId ? await runtime.databaseAdapter.getWorld(room.worldId) : null;

    // Get all entities in the room with their components
    const entitiesInRoom = await runtime.databaseAdapter.getEntitiesForRoom(room.id, true);

    // Filter components for each entity based on permissions
    const filteredEntities = await Promise.all(entitiesInRoom.map(async entity => {
      if (!entity.components) return entity;

      // Get world roles if we have a world
      const worldRoles = world?.metadata?.roles || {};

      // Filter components based on permissions
      entity.components = entity.components.filter(component => {
        // 1. Pass if sourceEntityId matches the requesting entity
        if (component.sourceEntityId === message.entityId) return true;

        // 2. Pass if sourceEntityId is an owner/admin of the current world
        if (world && component.sourceEntityId) {
          const sourceRole = worldRoles[component.sourceEntityId];
          if (sourceRole === "OWNER" || sourceRole === "ADMIN") return true;
        }

        // 3. Pass if sourceEntityId is the agentId
        if (component.sourceEntityId === runtime.agentId) return true;

        // Filter out components that don't meet any criteria
        return false;
      });

      return entity;
    }));

    // Get relationships for the message sender
    const relationships = await runtime.databaseAdapter.getRelationships({
      entityId: message.entityId,
    });

    // Get entities from relationships
    const relationshipEntities = await Promise.all(
      relationships.map(async rel => {
        const entityId = rel.sourceEntityId === message.entityId ? rel.targetEntityId : rel.sourceEntityId;
        return runtime.databaseAdapter.getEntityById(entityId);
      })
    );

    // Filter out nulls and combine with room entities
    const allEntities = [...filteredEntities, ...relationshipEntities.filter((e): e is Entity => e !== null)];
    
    // Get interaction strength data for relationship entities
    const interactionData = await getRecentInteractions(runtime, message.entityId, allEntities, room.id, relationships);

    // Compose context for LLM
    const prompt = composePrompt({
      state: {
        ...state,
        roomName: room.name || room.id,
        worldName: world?.name || "Unknown",
        entitiesInRoom: JSON.stringify(filteredEntities, null, 2),
        entityId: message.entityId,
        senderId: message.entityId,
      },
      template: entityResolutionTemplate
    });

    // Use LLM to analyze and resolve the entity
    const result = await runtime.useModel(ModelTypes.TEXT_LARGE, {
      prompt,
      stopSequences: []
    });

    // Parse LLM response
    const resolution = parseJSONObjectFromText(result);
    if (!resolution) {
      logger.warn("Failed to parse entity resolution result");
      return null;
    }

    // If we got an exact entity ID match
    if (resolution.type === "EXACT_MATCH" && resolution.entityId) {
      const entity = await runtime.databaseAdapter.getEntityById(resolution.entityId as UUID);
      if (entity) {
        // Filter components again for the returned entity
        if (entity.components) {
          const worldRoles = world?.metadata?.roles || {};
          entity.components = entity.components.filter(component => {
            if (component.sourceEntityId === message.entityId) return true;
            if (world && component.sourceEntityId) {
              const sourceRole = worldRoles[component.sourceEntityId];
              if (sourceRole === "OWNER" || sourceRole === "ADMIN") return true;
            }
            if (component.sourceEntityId === runtime.agentId) return true;
            return false;
          });
        }
        return entity;
      }
    }

    // For username/name/relationship matches, search through all entities
    if (resolution.matches?.[0]?.name) {
      const matchName = resolution.matches[0].name.toLowerCase();
      
      // Find matching entity by username/handle in components or by name
      const matchingEntity = allEntities.find(entity => {
        // Check names
        if (entity.names.some(n => n.toLowerCase() === matchName)) return true;
        
        // Check components for username/handle match
        return entity.components?.some(c => 
          c.data.username?.toLowerCase() === matchName ||
          c.data.handle?.toLowerCase() === matchName
        );
      });

      if (matchingEntity) {
        // If this is a relationship match, sort by interaction strength
        if (resolution.type === "RELATIONSHIP_MATCH") {
          const interactionInfo = interactionData.find(d => d.entity.id === matchingEntity.id);
          if (interactionInfo && interactionInfo.count > 0) {
            return matchingEntity;
          }
        } else {
          return matchingEntity;
        }
      }
    }

    return null;
  } catch (error) {
    logger.error("Error in findEntityByName:", error);
    return null;
  }
}

export const createUniqueUuid = (runtime, baseUserId: UUID | string): UUID => {
  // If the base user ID is the agent ID, return it directly
  if (baseUserId === runtime.agentId) {
    return runtime.agentId;
  }

  // Use a deterministic approach to generate a new UUID based on both IDs
  // This creates a unique ID for each user+agent combination while still being deterministic
  const combinedString = `${baseUserId}:${runtime.agentId}`;

  // Create a namespace UUID (version 5) from the combined string
  return stringToUuid(combinedString);
}

/**
 * Get details for a list of entities.
 */
export async function getEntityDetails({
  runtime,
  roomId,
}: {
  runtime: IAgentRuntime;
  roomId: UUID;
}) {
  const room = await runtime.databaseAdapter.getRoom(roomId);
  const roomEntities = await runtime.databaseAdapter.getEntitiesForRoom(roomId, true);
  const entities = roomEntities.map(entity => {
    // join all fields of all component.data together
    const allData = entity.components.reduce((acc, component) => {
      return { ...acc, ...component.data };
    }, {});

    // combine arrays and merge the values of objects
    const mergedData = Object.entries(allData).reduce((acc, [key, value]) => {
      if (!acc[key]) {
        acc[key] = value;
      } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
        acc[key] = [...new Set([...acc[key], ...value])];
      } else if (typeof acc[key] === 'object' && typeof value === 'object') {
        acc[key] = { ...acc[key], ...value };
      }
      return acc;
    }, {});

    return {
      id: entity.id,
      name: entity.metadata[room.source]?.name || entity.names[0],
      names: entity.names,
      data: JSON.stringify({...mergedData, ...entity.metadata})
    };
  });

  // Filter out nulls and ensure uniqueness by ID
  const uniqueEntities = new Map();
  entities
    .filter(entity => entity !== null)
    .forEach(entity => {
      if (!uniqueEntities.has(entity.id)) {
        uniqueEntities.set(entity.id, entity);
      }
    });

  return Array.from(uniqueEntities.values());
}

/**
 * Format entities into a string
 * @param entities - list of entities
 * @returns string
 */
export function formatEntities({ entities }: { entities: Entity[] }) {
  const entityStrings = entities.map((entity: Entity) => {
    const header = `${entity.names.join(" aka ")}\nID: ${entity.id}${(entity.metadata && Object.keys(entity.metadata).length > 0) ? `\nData: ${JSON.stringify(entity.metadata)}\n` : "\n"}`;
    return header;
  });
  return entityStrings.join("\n");
}

/**
 * Resolve an entity name to their UUID
 * @param name - Name to resolve
 * @param entities - List of entities to search through
 * @returns UUID if found, throws error if not found or if input is not a valid UUID
 */
export function resolveEntityId(name: string, entities: Entity[]): UUID {
  // If the name is already a valid UUID, return it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
    return name as UUID;
  }

  const entity = entities.find(a => 
    a.names.some(n => n.toLowerCase() === name.toLowerCase())
  );
  
  if (!entity) {
    throw new Error(`Could not resolve name "${name}" to a valid UUID`);
  }
  
  return entity.id;
}