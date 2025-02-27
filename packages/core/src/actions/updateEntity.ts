// I want to create an action that lets anyone create or update a component for an entity.
// Specifically, they can edit the data to add data organized by source type (kind of like a namespace), like twitter, discord, etc.
// The action should first check if the component exists for the entity, and if not, create it.
// We want to use an LLM (runtime.useModel) to generate the component data.
// We should include the prior component data if it exists, and have the LLM output an update to the component.
// Aside from the source type, we should also have an array of names for the entity.
// Components need to store a worldId, entityId (for who it belongs to), agentId obv

import { v4 as uuidv4 } from 'uuid';
import { logger } from "../logger";
import { 
  Action, 
  ActionExample,
  HandlerCallback, 
  IAgentRuntime, 
  Memory, 
  ModelClass, 
  State, 
  UUID
} from "../types";
import { composeContext } from "../context";

interface EntityComponentData {
  names: string[];
  sources: {
    [sourceType: string]: any;
  };
}

const componentGenerationTemplate = `# Task: Update Entity Component Data

{{#if existingData}}
# Existing Component Data:
\`\`\`json
{{existingData}}
\`\`\`
{{/if}}

# Recent Messages:
{{recentMessages}}

# Instructions:
Generate updated entity component data based on the conversation. The component should:
1. Include an array of names that can be used to refer to this entity
2. Have data organized by source type (e.g., twitter, discord, etc.)
3. Preserve existing data when appropriate
4. Add or update information based on the new conversation

Return a valid JSON object with the following structure:
{
  "names": ["name1", "name2", ...],
  "sources": {
    "sourceType1": { /* relevant data */ },
    "sourceType2": { /* relevant data */ },
    ...
  }
}

Ensure that the output is valid JSON.`;

export const updateEntityAction: Action = {
  name: "UPDATE_ENTITY",
  similes: ["CREATE_ENTITY", "EDIT_ENTITY", "UPDATE_COMPONENT", "CREATE_COMPONENT"],
  description: "Creates or updates a component for an entity with data organized by source type (like twitter, discord, etc.)",
  
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    // Check if the message mentions entity data that could be updated
    const text = message.content.text.toLowerCase();
    const entityUpdateKeywords = [
      "profile", "information", "data", "details", "about", 
      "update", "store", "save", "record", "component"
    ];
    
    return entityUpdateKeywords.some(keyword => text.includes(keyword));
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    responses: Memory[]
  ): Promise<void> => {
    try {
      // Handle initial responses
      for (const response of responses) {
        await callback(response.content);
      }

      const entityId = message.userId;
      const worldId = message.roomId;
      const agentId = runtime.agentId;
      
      // First, check if the component exists for the entity
      const entityComponent = await runtime.databaseAdapter.getComponent(entityId, "entityData", worldId, agentId);
      let existingData: EntityComponentData | null = null;
      
      if (entityComponent) {
        existingData = entityComponent.data as EntityComponentData;
        logger.info(`Found existing entity component for ${entityId}`);
      } else {
        logger.info(`No existing entity component found for ${entityId}, will create new one`);
      }
      
      // Generate updated component data using LLM
      const context = composeContext({
        state: {
          ...state,
          existingData: existingData ? JSON.stringify(existingData, null, 2) : null,
        },
        template: componentGenerationTemplate,
      });
      
      const generatedDataText = await runtime.useModel(ModelClass.TEXT_LARGE, {
        context,
        stopSequences: ["}"]
      });
      
      // Parse the generated data
      let componentData: EntityComponentData;
      try {
        // Find the JSON object in the response
        const jsonMatch = generatedDataText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON found in the LLM response");
        }
        
        componentData = JSON.parse(jsonMatch[0]);
        
        // Validate the structure
        if (!componentData.names || !Array.isArray(componentData.names)) {
          componentData.names = (existingData?.names || [message.content.user || "Unknown"]) as string[];
        }
        
        if (!componentData.sources || typeof componentData.sources !== 'object') {
          componentData.sources = existingData?.sources || {};
        }
      } catch (error) {
        logger.error(`Failed to parse component data: ${error.message}`);
        await callback({
          text: "I couldn't properly generate the entity data. Please try again with more specific information.",
          action: "UPDATE_ENTITY_ERROR",
          source: message.content.source,
        });
        return;
      }
      
      // Create or update the component
      if (entityComponent) {
        // Update existing component
        await runtime.databaseAdapter.updateComponent({
            entityId: entityId as UUID,
            worldId: worldId as UUID,
            type: "entityData",
            data: componentData,
            id: entityComponent.id,
            agentId,
            roomId: message.roomId,
            sourceEntityId: message.userId
        });
      } else {
        // Create new component
        await runtime.databaseAdapter.createComponent({
          id: uuidv4() as UUID,
          worldId: worldId as UUID,
          entityId: entityId as UUID,
          agentId,
          type: "entityData",
          data: componentData,
          roomId: message.roomId,
          sourceEntityId: message.userId
        });
      }
      
      // Confirm the update to the user
      await callback({
        text: `I've updated your entity information with the new details.`,
        action: "UPDATE_ENTITY",
        source: message.content.source,
      });
    } catch (error) {
      logger.error(`Error in updateEntity handler: ${error}`);
      await callback({
        text: "There was an error processing your entity information.",
        action: "UPDATE_ENTITY_ERROR",
        source: message.content.source,
      });
    }
  },
  
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Please update my profile with my Twitter handle @codehacker and my Discord username dev_guru#1234",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've updated your entity information with your Twitter and Discord details.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you store that I'm a software engineer at TechCorp and I like hiking on weekends?",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've saved your profession and hobby information to your profile.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Add to my LinkedIn data that I graduated from MIT in 2018 with a Computer Science degree",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've updated your LinkedIn information with your education details.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
  ] as ActionExample[][],
};

export default updateEntityAction;