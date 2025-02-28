// I want to create an action that lets anyone create or update a component for an entity.
// Components represent different sources of data about an entity (telegram, twitter, etc)
// Sources can be registered by plugins or inferred from room context and available components
// The action should first check if the component exists for the entity, and if not, create it.
// We want to use an LLM (runtime.useModel) to generate the component data.
// We should include the prior component data if it exists, and have the LLM output an update to the component.
// sourceEntityId represents who is making the update, entityId is who they are talking about

import { v4 as uuidv4 } from 'uuid';
import { logger } from "../logger";
import { 
  Action, 
  ActionExample,
  Component,
  HandlerCallback, 
  IAgentRuntime, 
  Memory, 
  ModelClass, 
  State, 
  UUID,
  Entity
} from "../types";
import { composeContext } from "../context";
import { findEntityByName } from "../entities";
import { parseJSONObjectFromText } from "../parsing";

const sourceExtractionTemplate = `# Task: Extract Source and Entity Information

# Recent Messages:
{{recentMessages}}

# Instructions:
Analyze the conversation to identify:
1. The source/platform being referenced (e.g. telegram, twitter, discord)
2. Any specific component data being shared (e.g. username, handle, display name)

Return a JSON object with:
{
  "source": "platform-name",
  "data": {
    // Relevant fields for that platform
    // e.g. username, handle, displayName, etc.
  }
}

Example outputs:
1. For "my telegram username is @dev_guru":
{
  "source": "telegram",
  "data": {
    "username": "dev_guru"
  }
}

2. For "update my twitter handle to @tech_master":
{
  "source": "twitter",
  "data": {
    "handle": "tech_master"
  }
}`;

const componentGenerationTemplate = `# Task: Update Entity Component Data

Component Type: {{componentType}}

{{#if existingData}}
# Existing Component Data:
\`\`\`json
{{existingData}}
\`\`\`
{{/if}}

# New Information:
\`\`\`json
{{newData}}
\`\`\`

# Instructions:
Generate updated component data for the {{componentType}} component. The data should:
1. Be specific to the {{componentType}} platform/source
2. Preserve existing data when appropriate
3. Merge new information with existing data
4. Return only valid data for this component type

Return a valid JSON object with data relevant to {{componentType}}.
For example:
- telegram: username, display_name
- twitter: handle, display_name
- discord: username, display_name, discriminator

Ensure the output is valid JSON and contains ONLY fields relevant to {{componentType}}.`;

export const updateEntityAction: Action = {
  name: "UPDATE_ENTITY",
  similes: ["CREATE_ENTITY", "EDIT_ENTITY", "UPDATE_COMPONENT", "CREATE_COMPONENT"],
  description: "Creates or updates components for entities with data organized by source type (like twitter, discord, etc.)",
  
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ): Promise<boolean> => {
    // Check if we have any registered sources or existing components that could be updated
    const worldId = message.roomId;
    const agentId = runtime.agentId;
    
    // Get all components for the current room to understand available sources
    const roomComponents = await runtime.databaseAdapter.getComponents(message.roomId, worldId, agentId);
    
    // Get source types from room components
    const availableSources = new Set(roomComponents.map(c => c.type));
    
    // TODO: Add ability for plugins to register their sources
    // const registeredSources = runtime.getRegisteredSources?.() || [];
    // availableSources.add(...registeredSources);
    
    return availableSources.size > 0;
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

      const sourceEntityId = message.userId;
      const roomId = message.roomId;
      const agentId = runtime.agentId;
      const room = await runtime.getRoom(roomId);
      const worldId = room.worldId;

      // First, find the entity being referenced
      const entity = await findEntityByName(runtime, message.content.text, message, state);
      
      if (!entity) {
        await callback({
          text: "I'm not sure which entity you're trying to update. Could you please specify who you're talking about?",
          action: "UPDATE_ENTITY_ERROR",
          source: message.content.source,
        });
        return;
      }

      // Extract source and component data from the message
      const sourceContext = composeContext({
        state,
        template: sourceExtractionTemplate,
      });

      const sourceResult = await runtime.useModel(ModelClass.TEXT_LARGE, {
        context: sourceContext,
        stopSequences: ["}"]
      });

      const sourceData = parseJSONObjectFromText(sourceResult);
      if (!sourceData?.source) {
        await callback({
          text: "I couldn't determine what information you want to update. Could you please specify the platform (like telegram, twitter, etc.) and the information you want to update?",
          action: "UPDATE_ENTITY_ERROR",
          source: message.content.source,
        });
        return;
      }

      const componentType = sourceData.source.toLowerCase();
      
      // Get existing component if it exists
      const existingComponent = await runtime.databaseAdapter.getComponent(
        entity.id!,
        componentType,
        worldId,
        sourceEntityId
      );

      // Generate updated component data
      const context = composeContext({
        state: {
          ...state,
          componentType,
          existingData: existingComponent ? JSON.stringify(existingComponent.data, null, 2) : null,
          newData: JSON.stringify(sourceData.data, null, 2),
        },
        template: componentGenerationTemplate,
      });
      
      const generatedDataText = await runtime.useModel(ModelClass.TEXT_LARGE, {
        context,
        stopSequences: ["}"]
      });
      
      // Parse the generated data
      let componentData: any;
      try {
        const jsonMatch = generatedDataText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON found in the LLM response");
        }
        
        componentData = JSON.parse(jsonMatch[0]);
      } catch (error) {
        logger.error(`Failed to parse component data: ${error.message}`);
        await callback({
          text: "I couldn't properly generate the component data. Please try again with more specific information.",
          action: "UPDATE_ENTITY_ERROR",
          source: message.content.source,
        });
        return;
      }
      
      // Create or update the component
      if (existingComponent) {
        await runtime.databaseAdapter.updateComponent({
          id: existingComponent.id,
          entityId: entity.id!,
          worldId,
          type: componentType,
          data: componentData,
          agentId,
          roomId: message.roomId,
          sourceEntityId
        });

        await callback({
          text: `I've updated the ${componentType} information for ${entity.names[0]}.`,
          action: "UPDATE_ENTITY",
          source: message.content.source,
        });
      } else {
        await runtime.databaseAdapter.createComponent({
          id: uuidv4() as UUID,
          entityId: entity.id!,
          worldId,
          type: componentType,
          data: componentData,
          agentId,
          roomId: message.roomId,
          sourceEntityId
        });

        await callback({
          text: `I've added new ${componentType} information for ${entity.names[0]}.`,
          action: "UPDATE_ENTITY",
          source: message.content.source,
        });
      }
    } catch (error) {
      logger.error(`Error in updateEntity handler: ${error}`);
      await callback({
        text: "There was an error processing the entity information.",
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
          text: "Please update my telegram username to @dev_guru",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've updated your telegram information.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Set Jimmy's twitter handle to @jimmy_codes",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've updated Jimmy's twitter information.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Update my discord username to dev_guru#1234",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've updated your discord information.",
          action: "UPDATE_ENTITY",
        },
      },
    ],
  ] as ActionExample[][],
};

export default updateEntityAction;