import { composeContext } from "./context.ts";
import { logger } from "./index.ts";
import { parseJSONObjectFromText } from "./parsing";
import {
    type Entity,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type UUID
} from "./types.ts";

const entityResolutionTemplate = `# Task: Resolve Entity Name

# Examples:
1. Query: "me"
   Result: {
     "entityId": "user-123",
     "type": "EXACT_MATCH",
     "matches": [{
       "name": "Alice",
       "reason": "Message sender referring to themselves"
     }]
   }

2. Query: "you"
   Result: {
     "entityId": "agent-456",
     "type": "EXACT_MATCH",
     "matches": [{
       "name": "Assistant",
       "reason": "Direct reference to the agent"
     }]
   }

3. Query: "@username"
   Result: {
     "entityId": null,
     "type": "USERNAME_MATCH",
     "matches": [{
       "name": "username",
       "reason": "Exact match with user's handle"
     }]
   }

4. Query: "John"
   Result: {
     "entityId": null,
     "type": "NAME_MATCH",
     "matches": [{
       "name": "John Smith",
       "reason": "Name matches entity's display name"
     }]
   }

Current Room: {{roomName}}
Current World: {{worldName}}
Message Sender: {{senderName}} (ID: {{userId}})
Agent: {{agentName}} (ID: {{agentId}})

# Entities in Room:
{{#if entitiesInRoom}}
{{entitiesInRoom}}
{{/if}}

# Recent Messages:
{{recentMessages}}

# Query:
{{query}}

# Instructions:
1. Analyze the query and context to identify which entity is being referenced
2. Consider special references like "me" (message sender) or "you" (agent)
3. Look for usernames/handles in standard formats (e.g. @username, user#1234)
4. Consider context from recent messages for pronouns and references
5. If multiple matches exist, use context to disambiguate

Return a JSON object with:
{
  "entityId": "exact-id-if-known-otherwise-null",
  "type": "EXACT_MATCH | USERNAME_MATCH | NAME_MATCH | AMBIGUOUS | UNKNOWN",
  "matches": [{
    "name": "matched-name",
    "reason": "why this entity matches"
  }]
}`;

export async function findEntityByName(
  runtime: IAgentRuntime,
  query: string,
  message: Memory,
  state: State,
  options: {
    worldId?: UUID;
  } = {}
): Promise<Entity | null> {
  try {
    const room = await runtime.getRoom(message.roomId);
    if (!room) {
      logger.warn("Room not found for entity search");
      return null;
    }

    const world = room.worldId ? await runtime.getWorld(room.worldId) : null;

    // Get all entities in the room with their components
    const entitiesInRoom = await runtime.databaseAdapter.getEntitiesForRoom(room.id, runtime.agentId, true);

    // Compose context for LLM
    const context = composeContext({
      state: {
        ...state,
        roomName: room.name || room.id,
        worldName: world?.name || "Unknown",
        entitiesInRoom: JSON.stringify(entitiesInRoom, null, 2),
        userId: message.userId,
        query
      },
      template: entityResolutionTemplate
    });

    // Use LLM to analyze and resolve the entity
    const result = await runtime.useModel(ModelClass.TEXT_LARGE, {
      context,
      stopSequences: ["}"]
    });

    // Parse LLM response
    const resolution = parseJSONObjectFromText(result);
    if (!resolution) {
      logger.warn("Failed to parse entity resolution result");
      return null;
    }

    // If we got an exact entity ID match
    if (resolution.type === "EXACT_MATCH" && resolution.entityId) {
      const entity = await runtime.databaseAdapter.getEntityById(resolution.entityId as UUID, runtime.agentId);
      if (entity) return entity;
    }

    // For username/name matches, search through formatted entities
    if (resolution.matches?.[0]?.name) {
      const matchName = resolution.matches[0].name.toLowerCase();
      
      // Find matching entity by username/handle in components or by name
      const matchingEntity = entitiesInRoom.find(entity => {
        // Check names
        if (entity.names.some(n => n.toLowerCase() === matchName)) return true;
        
        // Check components for username/handle match
        return entity.components?.some(c => 
          c.data.username?.toLowerCase() === matchName ||
          c.data.handle?.toLowerCase() === matchName
        );
      });

      if (matchingEntity) {
        return matchingEntity;
      }
    }

    return null;
  } catch (error) {
    logger.error("Error in findEntityByName:", error);
    return null;
  }
}