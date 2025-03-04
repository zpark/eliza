// action: SEND_MESSAGE
// send message to a user or room (other than this room we are in)

import { composeContext } from "../context";
import { findEntityByName } from "../entities";
import { logger } from "../logger";
import { parseJSONObjectFromText } from "../parsing";
import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelTypes,
  type State,
  UUID
} from "../types";

const targetExtractionTemplate = `# Task: Extract Target and Source Information

# Recent Messages:
{{recentMessages}}

# Instructions:
Analyze the conversation to identify:
1. The target type (user or room)
2. The target platform/source (e.g. telegram, discord, etc)
3. Any identifying information about the target

Return a JSON object with:
\`\`\`json
{
  "targetType": "user|room",
  "source": "platform-name",
  "identifiers": {
    // Relevant identifiers for that target
    // e.g. username, roomName, etc.
  }
}
\`\`\`
Example outputs:
1. For "send a message to @dev_guru on telegram":
\`\`\`json
{
  "targetType": "user",
  "source": "telegram",
  "identifiers": {
    "username": "dev_guru"
  }
}
\`\`\`

2. For "post this in #announcements":
\`\`\`json
{
  "targetType": "room",
  "source": "discord",
  "identifiers": {
    "roomName": "announcements"
  }
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.`;
export const sendMessageAction: Action = {
  name: "SEND_MESSAGE",
  similes: ["DM", "MESSAGE", "SEND_DM", "POST_MESSAGE"],
  description: "Send a message to a user or room (other than the current one)",
  
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    // Check if we have permission to send messages
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
      const _agentId = runtime.agentId;
      const room = await runtime.databaseAdapter.getRoom(roomId);
      const worldId = room.worldId;

      // Extract target and source information
      const targetContext = composeContext({
        state,
        template: targetExtractionTemplate,
      });

      const targetResult = await runtime.useModel(ModelTypes.TEXT_LARGE, {
        context: targetContext,
        stopSequences: []
      });

      const targetData = parseJSONObjectFromText(targetResult);
      if (!targetData?.targetType || !targetData?.source) {
        await callback({
          text: "I couldn't determine where you want me to send the message. Could you please specify the target (user or room) and platform?",
          action: "SEND_MESSAGE_ERROR",
          source: message.content.source,
        });
        return;
      }

      const source = targetData.source.toLowerCase();

      if (targetData.targetType === "user") {
        // Try to find the target user entity
        const targetEntity = await findEntityByName(runtime, message, state);
        
        if (!targetEntity) {
          await callback({
            text: "I couldn't find the user you want me to send a message to. Could you please provide more details about who they are?",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
          return;
        }

        // Get the component for the specified source
        const userComponent = await runtime.databaseAdapter.getComponent(
          targetEntity.id!,
          source,
          worldId,
          sourceEntityId
        );

        if (!userComponent) {
          await callback({
            text: `I couldn't find ${source} information for that user. Could you please provide their ${source} details?`,
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
          return;
        }

        const sendDirectMessage = runtime.getService(source)?.sendDirectMessage;

        if (!sendDirectMessage) {
          await callback({
            text: "I couldn't find the user you want me to send a message to. Could you please provide more details about who they are?",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
          return;
        }
        // Send the message using the appropriate client
        try {
          await sendDirectMessage(
            runtime,
            targetEntity.id!,
            source,
            message.content.text,
            worldId
          );

          await callback({
            text: `Message sent to ${targetEntity.names[0]} on ${source}.`,
            action: "SEND_MESSAGE",
            source: message.content.source,
          });
        } catch (error) {
          logger.error(`Failed to send direct message: ${error.message}`);
          await callback({
            text: "I encountered an error trying to send the message. Please try again.",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
        }

      } else if (targetData.targetType === "room") {
        // Try to find the target room
        const rooms = await runtime.databaseAdapter.getRooms(worldId);
        const targetRoom = rooms.find(r => {
          // Match room name from identifiers
          return r.name.toLowerCase() === targetData.identifiers.roomName?.toLowerCase();
        });

        if (!targetRoom) {
          await callback({
            text: "I couldn't find the room you want me to send a message to. Could you please specify the exact room name?",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
          return;
        }

        const sendRoomMessage = runtime.getService(source)?.sendRoomMessage;

        if (!sendRoomMessage) {
          await callback({
            text: "I couldn't find the room you want me to send a message to. Could you please specify the exact room name?",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
          return;
        }
          
        // Send the message to the room
        try {
          await sendRoomMessage(
            runtime,
            targetRoom.id,
            source,
            message.content.text,
            worldId
          );

          await callback({
            text: `Message sent to ${targetRoom.name} on ${source}.`,
            action: "SEND_MESSAGE",
            source: message.content.source,
          });
        } catch (error) {
          logger.error(`Failed to send room message: ${error.message}`);
          await callback({
            text: "I encountered an error trying to send the message to the room. Please try again.",
            action: "SEND_MESSAGE_ERROR",
            source: message.content.source,
          });
        }
      }

    } catch (error) {
      logger.error(`Error in sendMessage handler: ${error}`);
      await callback({
        text: "There was an error processing your message request.",
        action: "SEND_MESSAGE_ERROR",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Send a message to @dev_guru on telegram saying 'Hello!'",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Message sent to dev_guru on telegram.",
          action: "SEND_MESSAGE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Post 'Important announcement!' in #announcements",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Message sent to announcements.",
          action: "SEND_MESSAGE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "DM Jimmy and tell him 'Meeting at 3pm'",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Message sent to Jimmy.",
          action: "SEND_MESSAGE",
        },
      },
    ],
  ] as ActionExample[][],
};

export default sendMessageAction;