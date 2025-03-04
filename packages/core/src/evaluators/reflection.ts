import { z } from "zod";
import { composeContext } from "../context";
import { MemoryManager } from "../memory";
import {
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  ModelTypes,
  type UUID,
} from "../types";
import { getActorDetails, resolveActorId } from "../messages";
import logger from "../logger";

// Schema definitions for the reflection output
const relationshipSchema = z.object({
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  tags: z.array(z.string()),
  metadata: z
    .object({
      interactions: z.number(),
    })
    .optional(),
});

const reflectionSchema = z.object({
  // reflection: z.string(),
  facts: z.array(
    z.object({
      claim: z.string(),
      type: z.string(),
      in_bio: z.boolean(),
      already_known: z.boolean(),
    })
  ),
  relationships: z.array(relationshipSchema),
});

const reflectionTemplate = `# Task: Generate Agent Reflection, Extract Facts and Relationships

# Examples:
{{evaluationExamples}}

{{actors}}

{{bio}}

# Entities in Room
{{entitiesInRoom}}

# Existing Relationships
{{existingRelationships}}

# Current Context:
Agent Name: {{agentName}}
Room Type: {{roomType}}
Message Sender: {{senderName}} (ID: {{senderId}})

{{recentMessages}}

# Known Facts:
{{knownFacts}}

# Instructions:
1. Extract new facts from the conversation
2. Identify and describe relationships between entities. The sourceEntityId is the UUID of the entity initiating the interaction. The targetEntityId is the UUID of the entity being interacted with. Relationships are one-direction, so a friendship would be two entity relationships where each entity is both the source and the target of the other.

Generate a response in the following format:
\`\`\`json
{
    "facts": [
        {
            "claim": "factual statement",
            "type": "fact|opinion|status",
            "in_bio": false,
            "already_known": false
        }
    ],
    "relationships": [
        {
            "sourceEntityId": "entity_initiating_interaction",
            "targetEntityId": "entity_being_interacted_with",
            "tags": ["group_interaction|voice_interaction|dm_interaction", "additional_tag1", "additional_tag2"]
        }
    ]
}
\`\`\``;

const generateObject = async ({
  runtime,
  context,
  modelType = ModelTypes.TEXT_LARGE,
  stopSequences = [],
  output = "object",
  enumValues = [],
  schema,
}): Promise<any> => {
  if (!context) {
    const errorMessage = "generateObject context is empty";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Special handling for enum output type
  if (output === "enum" && enumValues) {
    const response = await runtime.useModel(modelType, {
      runtime,
      context,
      modelType,
      stopSequences,
      maxTokens: 8,
      object: true,
    });

    // Clean up the response to extract just the enum value
    const cleanedResponse = response.trim();

    // Verify the response is one of the allowed enum values
    if (enumValues.includes(cleanedResponse)) {
      return cleanedResponse;
    }

    // If the response includes one of the enum values (case insensitive)
    const matchedValue = enumValues.find((value) =>
      cleanedResponse.toLowerCase().includes(value.toLowerCase())
    );

    if (matchedValue) {
      return matchedValue;
    }

    logger.error(`Invalid enum value received: ${cleanedResponse}`);
    logger.error(`Expected one of: ${enumValues.join(", ")}`);
    return null;
  }

  // Regular object/array generation
  const response = await runtime.useModel(modelType, {
    runtime,
    context,
    modelType,
    stopSequences,
    object: true,
  });

  let jsonString = response;

  // Find appropriate brackets based on expected output type
  const firstChar = output === "array" ? "[" : "{";
  const lastChar = output === "array" ? "]" : "}";

  const firstBracket = response.indexOf(firstChar);
  const lastBracket = response.lastIndexOf(lastChar);

  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    jsonString = response.slice(firstBracket, lastBracket + 1);
  }

  if (jsonString.length === 0) {
    logger.error(`Failed to extract JSON ${output} from model response`);
    return null;
  }

  // Parse the JSON string
  try {
    const json = JSON.parse(jsonString);

    // Validate against schema if provided
    if (schema) {
      return schema.parse(json);
    }

    return json;
  } catch (_error) {
    logger.error(`Failed to parse JSON ${output}`);
    logger.error(jsonString);
    return null;
  }
};

async function handler(runtime: IAgentRuntime, message: Memory) {
  const state = await runtime.composeState(message);
  const { agentId, roomId } = state;

  // Get existing relationships for the room
  const existingRelationships = await runtime.databaseAdapter.getRelationships({
    userId: message.userId,
  });

  // Get actors in the room for name resolution
  const actors = await getActorDetails({ runtime, roomId });

  const entitiesInRoom = await runtime.databaseAdapter.getEntitiesForRoom(
    roomId
  );

  // Get known facts
  const factsManager = new MemoryManager({
    runtime,
    tableName: "facts",
  });

  const knownFacts = await factsManager.getMemories({
    roomId,
    agentId,
    count: 30,
    unique: true,
  });

  const context = composeContext({
    state: {
      ...state,
      knownFacts: formatFacts(knownFacts),
      roomType: state.roomType || "group", // Can be "group", "voice", or "dm"
      entitiesInRoom: JSON.stringify(entitiesInRoom),
      existingRelationships: JSON.stringify(existingRelationships),
      senderId: message.userId,
    },
    template:
      runtime.character.templates?.reflectionTemplate || reflectionTemplate,
  });

  const reflection = await generateObject({
    runtime,
    context,
    modelType: ModelTypes.TEXT_LARGE,
    schema: reflectionSchema,
  });

  // Store new facts
  const newFacts = reflection.facts.filter(
    (fact) =>
      !fact.already_known &&
      !fact.in_bio &&
      fact.claim &&
      fact.claim.trim() !== ""
  );

  for (const fact of newFacts) {
    const factMemory = await factsManager.addEmbeddingToMemory({
      userId: agentId,
      agentId,
      content: { text: fact.claim },
      roomId,
      createdAt: Date.now(),
    });
    await factsManager.createMemory(factMemory, true);
  }

  // Update or create relationships
  for (const relationship of reflection.relationships) {
    let sourceId: UUID;
    let targetId: UUID;

    try {
      sourceId = resolveActorId(relationship.sourceEntityId, actors);
      targetId = resolveActorId(relationship.targetEntityId, actors);
    } catch (error) {
      console.warn("Failed to resolve relationship entities:", error);
      console.warn("relationship:\n", relationship);
      continue; // Skip this relationship if we can't resolve the IDs
    }

    const existingRelationship = existingRelationships.find(
      (r) => r.sourceEntityId === sourceId && r.targetEntityId === targetId
    );

    if (existingRelationship) {
      const updatedMetadata = {
        ...existingRelationship.metadata,
        interactions: (existingRelationship.metadata?.interactions || 0) + 1,
      };

      const updatedTags = Array.from(
        new Set([...(existingRelationship.tags || []), ...relationship.tags])
      );

      await runtime.databaseAdapter.updateRelationship({
        id: existingRelationship.id,
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        agentId,
        tags: updatedTags,
        metadata: updatedMetadata,
      });
    } else {
      await runtime.databaseAdapter.createRelationship({
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        tags: relationship.tags,
        metadata: {
          interactions: 1,
          ...relationship.metadata,
        },
      });
    }
  }

  await runtime.databaseAdapter.setCache<string>(
    `${message.roomId}-reflection-last-processed`,
    message.id
  );

  return reflection;
}

export const reflectionEvaluator: Evaluator = {
  name: "REFLECTION",
  similes: [
    "REFLECT",
    "SELF_REFLECT",
    "EVALUATE_INTERACTION",
    "ASSESS_SITUATION",
  ],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const lastMessageId = await runtime.databaseAdapter.getCache<string>(
      `${message.roomId}-reflection-last-processed`
    );
    const messages = await runtime.messageManager.getMemories({
      roomId: message.roomId,
      count: runtime.getConversationLength(),
    });

    if (lastMessageId) {
      const lastMessageIndex = messages.findIndex(
        (msg) => msg.id === lastMessageId
      );
      if (lastMessageIndex !== -1) {
        messages.splice(0, lastMessageIndex + 1);
      }
    }

    const reflectionInterval = Math.ceil(runtime.getConversationLength() / 4);

    return messages.length > reflectionInterval;
  },
  description:
    "Generate self-reflection, extract facts, and track relationships between entities in the conversation.",
  handler,
  examples: [
    {
      context: `Agent Name: Sarah
Agent Role: Community Manager
Room Type: group
Current Room: general-chat
Message Sender: John (user-123)`,
      messages: [
        {
          user: "John",
          content: { text: "Hey everyone, I'm new here!" },
        },
        {
          user: "Sarah",
          content: { text: "Welcome John! How did you find our community?" },
        },
        {
          user: "John",
          content: { text: "Through a friend who's really into AI" },
        },
      ],
      outcome: `{
    "reflection": "I'm engaging appropriately with a new community member, maintaining a welcoming and professional tone. My questions are helping to learn more about John and make him feel welcome.",
    "facts": [
        {
            "claim": "John is new to the community",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        },
        {
            "claim": "John found the community through a friend interested in AI",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        }
    ],
    "relationships": [
        {
            "sourceEntityId": "sarah-agent",
            "targetEntityId": "user-123",
            "tags": ["group_interaction"]
        },
        {
            "sourceEntityId": "user-123",
            "targetEntityId": "sarah-agent",
            "tags": ["group_interaction"]
        }
    ]
}`,
    },
  ],
};

// Helper function to format facts for context
function formatFacts(facts: Memory[]) {
  return facts
    .reverse()
    .map((fact: Memory) => fact.content.text)
    .join("\n");
}
