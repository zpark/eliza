import { z } from "zod";
import { composeContext } from "../context";
import { generateObject } from "../generation";
import { MemoryManager } from "../memory";
import { Evaluator, IAgentRuntime, Memory, ModelClass, UUID } from "../types";
import { getActorDetails, resolveActorId } from "../messages";

// Schema definitions for the reflection output
const relationshipSchema = z.object({
    sourceEntityId: z.string(),
    targetEntityId: z.string(),
    tags: z.array(z.string()),
    metadata: z.object({
        interactions: z.number(),
    }).optional(),
});

const reflectionSchema = z.object({
    reflection: z.string(),
    facts: z.array(z.object({
        claim: z.string(),
        type: z.string(),
        in_bio: z.boolean(),
        already_known: z.boolean(),
    })),
    relationships: z.array(relationshipSchema),
});

const reflectionTemplate = `# Task: Generate Agent Reflection, Extract Facts and Relationships

# Examples:
{{evaluationExamples}}

{{actors}}

{{bio}}

# Current Context:
Agent Name: {{agentName}}
Room Type: {{roomType}}
Message Sender: {{senderName}} (ID: {{senderId}})

# Recent Messages:
{{recentMessages}}

# Known Facts:
{{knownFacts}}

# Instructions:
1. Generate a self-reflection monologue about recent interactions
2. Extract new facts from the conversation
3. Identify and describe relationships between entities

Generate a response in the following format:
\`\`\`json
{
    "reflection": "A thoughtful self-reflection monologue about how the interaction is going...",
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

async function handler(runtime: IAgentRuntime, message: Memory) {
    const state = await runtime.composeState(message);
    const { agentId, roomId } = state;

    // Get existing relationships for the room
    const existingRelationships = await runtime.databaseAdapter.getRelationships({ 
        userId: message.userId,
        agentId 
    });

    // Get actors in the room for name resolution
    const actors = await getActorDetails({ runtime, roomId });

    // Get known facts
    const factsManager = new MemoryManager({
        runtime,
        tableName: "facts",
    });

    const knownFacts = await factsManager.getMemories({ 
        roomId,
        agentId
    });

    const context = composeContext({
        state: {
            ...state,
            knownFacts: formatFacts(knownFacts),
            roomType: state.roomType || "group", // Can be "group", "voice", or "dm"
        },
        template: runtime.character.templates?.reflectionTemplate || reflectionTemplate,
    });

    const reflection = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.TEXT_LARGE,
        schema: reflectionSchema,
        schemaName: "Reflection",
        schemaDescription: "Agent reflection including facts and relationships",
    });

    // Store new facts
    const newFacts = reflection.facts.filter(fact => 
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
        console.log("*** resolving relationship", relationship);
        let sourceId: UUID;
        let targetId: UUID;
        
        try {
            sourceId = resolveActorId(relationship.sourceEntityId, actors);
            targetId = resolveActorId(relationship.targetEntityId, actors);
        } catch (error) {
            console.warn('Failed to resolve relationship entities:', error);
            continue; // Skip this relationship if we can't resolve the IDs
        }
        
        const existingRelationship = existingRelationships.find(r => 
            r.sourceEntityId === sourceId && 
            r.targetEntityId === targetId
        );

        if (existingRelationship) {
            // Update existing relationship by creating a new one
            const updatedMetadata = {
                ...existingRelationship.metadata,
                interactions: (existingRelationship.metadata?.interactions || 0) + 1
            };

            // Merge tags, removing duplicates
            const updatedTags = Array.from(new Set([
                ...(existingRelationship.tags || []),
                ...relationship.tags
            ]));

            await runtime.databaseAdapter.updateRelationship({
                id: existingRelationship.id,
                sourceEntityId: sourceId,
                targetEntityId: targetId,
                agentId,
                tags: updatedTags,
                metadata: updatedMetadata,
            });
        } else {
            // Create new relationship
            await runtime.databaseAdapter.createRelationship({
                sourceEntityId: sourceId,
                targetEntityId: targetId,
                agentId,
                tags: relationship.tags,
                metadata: {
                    interactions: 1,
                    ...relationship.metadata
                }
            });
        }
    }

    // Store the reflection itself as a memory
    const reflectionMemory = await runtime.messageManager.addEmbeddingToMemory({
        userId: agentId,
        agentId,
        content: { 
            text: `(Reflecting to self: ${reflection.reflection}`,
            action: "REFLECTION"
        },
        roomId,
        createdAt: Date.now(),
    });
    const memoryId = await runtime.messageManager.createMemory(reflectionMemory, true);

    await runtime.cacheManager.set(`${message.roomId}-reflection-last-processed`, memoryId);

    return reflection;
}

export const reflectionEvaluator: Evaluator = {
    name: "REFLECTION",
    similes: [
        "REFLECT",
        "SELF_REFLECT",
        "EVALUATE_INTERACTION",
        "ASSESS_SITUATION"
    ],
    validate: async (
        runtime: IAgentRuntime,
        message: Memory
    ): Promise<boolean> => {
        const lastMessageId = await runtime.cacheManager.get(`${message.roomId}-reflection-last-processed`)
        const messages = await runtime.messageManager.getMemories({ roomId: message.roomId, count: runtime.getConversationLength() })

        if (lastMessageId) {
            const lastMessageIndex = messages.findIndex(msg => msg.id === lastMessageId);
            if (lastMessageIndex !== -1) {
                messages.splice(0, lastMessageIndex + 1);
            }
        }
        
        const reflectionInterval = Math.ceil(runtime.getConversationLength() / 4);

        return messages.length > reflectionInterval;
    },
    description: "Generate self-reflection, extract facts, and track relationships between entities in the conversation.",
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
                }
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
}`
        }
    ]
};

// Helper function to format facts for context
function formatFacts(facts: Memory[]) {
    return facts
        .reverse()
        .map((fact: Memory) => fact.content.text)
        .join("\n");
}
