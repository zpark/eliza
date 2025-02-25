import { v4 } from "uuid";
import { composeContext } from "./context.ts";
import { generateMessageResponse, generateShouldRespond } from "./generation.ts";
import { logger } from "./logger.ts";
import { messageCompletionFooter, shouldRespondFooter } from "./parsing.ts";
import { ModelClass, type Actor, type Content, type HandlerCallback, type IAgentRuntime, type Memory, type State, type UUID } from "./types.ts";
import { stringToUuid } from "./uuid.ts";
export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

/**
 * Get details for a list of actors.
 */
export async function getActorDetails({
  runtime,
  roomId,
}: {
  runtime: IAgentRuntime;
  roomId: UUID;
}) {
  const participantIds = await runtime.databaseAdapter.getParticipantsForRoom(
    roomId,
    runtime.agentId
  );
  const actors = await Promise.all(
    participantIds.map(async (userId) => {
      const account = await runtime.databaseAdapter.getEntityById(userId, runtime.agentId);
      if (account) {
        return {
          id: account.id,
          name: account.metadata.name,
          username: account.metadata.username,
        };
      }
      return null;
    })
  );

  return actors.filter((actor): actor is Actor => actor !== null);
}

/**
 * Format actors into a string
 * @param actors - list of actors
 * @returns string
 */
export function formatActors({ actors }: { actors: Actor[] }) {
  const actorStrings = actors.map((actor: Actor) => {
    const header = `${actor.name}`;
    return header;
  });
  const finalActorStrings = actorStrings.join("\n");
  return finalActorStrings;
}

/**
 * Format messages into a string
 * @param {Object} params - The formatting parameters
 * @param {Memory[]} params.messages - List of messages to format
 * @param {Actor[]} params.actors - List of actors for name resolution
 * @returns {string} Formatted message string with timestamps and user information
 */
export const formatMessages = ({
  messages,
  actors,
}: {
  messages: Memory[];
  actors: Actor[];
}) => {
  const messageStrings = messages
    .reverse()
    .filter((message: Memory) => message.userId)
    .map((message: Memory) => {
      const messageContent = (message.content as Content).text;
      const messageAction = (message.content as Content).action;
      const formattedName =
        actors.find((actor: Actor) => actor.id === message.userId)?.name ||
        "Unknown User";

      const attachments = (message.content as Content).attachments;

      const attachmentString =
        attachments && attachments.length > 0
          ? ` (Attachments: ${attachments
              .map((media) => `[${media.id} - ${media.title} (${media.url})]`)
              .join(", ")})`
          : "";

      const timestamp = formatTimestamp(message.createdAt);

      const shortId = message.userId.slice(-5);

      return `(${timestamp}) [${shortId}] ${formattedName}: ${messageContent}${attachmentString}${
        messageAction && messageAction !== "null" ? ` (${messageAction})` : ""
      }`;
    })
    .join("\n");
  return messageStrings;
};

export const formatTimestamp = (messageDate: number) => {
  const now = new Date();
  const diff = now.getTime() - messageDate;

  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (absDiff < 60000) {
    return "just now";
  }if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
    return `${days} day${days !== 1 ? "s" : ""} ago`;
};

export const shouldRespondTemplate =
  `# Task: Decide if {{agentName}} should respond.
{{providers}}

About {{agentName}}:
{{bio}}

{{recentMessages}}

# INSTRUCTIONS: Respond with the word RESPOND if {{agentName}} should respond to the message. Respond with STOP if a user asks {{agentName}} to be quiet. Respond with IGNORE if {{agentName}} should ignore the message.
${shouldRespondFooter}`;

const messageHandlerTemplate =
  // {{goals}}
  `# Task: Generate dialog and actions for the character {{agentName}}.
{{system}}

{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

About {{agentName}}:
{{bio}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{providers}}

{{actions}}

{{messageDirections}}

{{recentMessages}}

# Instructions: Write the next message for {{agentName}}. Include the appropriate action from the list: {{actionNames}}
${messageCompletionFooter}`;

type MessageReceivedHandlerParams = {
  runtime: IAgentRuntime;
  message: Memory;
  callback: HandlerCallback;
};

const checkShouldRespond = async (
  runtime: IAgentRuntime,
  message: Memory,
  state: State
): Promise<boolean> => {
  if (message.userId === runtime.agentId) return false;

  const agentUserState = await runtime.databaseAdapter.getParticipantUserState(
    message.roomId,
    message.agentId,
    runtime.agentId,
  );

  if (
    agentUserState === "MUTED" &&
    !message.content.text
      .toLowerCase()
      .includes(runtime.character.name.toLowerCase())
  ) {
    console.log("Ignoring muted room");
    return false;
  }

  if (agentUserState === "FOLLOWED") {
    return true;
  }

  if (
    message.content.text
      .toLowerCase()
      .includes(runtime.character.name.toLowerCase())
  ) {
    return true;
  }

  const shouldRespondContext = composeContext({
    state,
    template:
      runtime.character.templates?.shouldRespondTemplate ||
      shouldRespondTemplate,
  });

  const response = await generateShouldRespond({
    runtime: runtime,
    context: shouldRespondContext,
    modelClass: ModelClass.TEXT_SMALL,
  });

  if (response.includes("RESPOND")) {
    return true;
  }

  if (response.includes("IGNORE")) {
    return false;
  }

  if (response.includes("STOP")) {
    return false;
  }
    console.error("Invalid response from response generateText:", response);
    return false;
};

const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
}: MessageReceivedHandlerParams) => {

  // First, save the incoming message
  await runtime.messageManager.addEmbeddingToMemory(message);
  await runtime.messageManager.createMemory(message);

  // Then, compose the state, which includes the incoming message in the recent messages
  let state = await runtime.composeState(message);

  const shouldRespond = await checkShouldRespond(runtime, message, state);

  if (shouldRespond) {
    const context = composeContext({
      state,
      template:
        runtime.character.templates?.messageHandlerTemplate ||
        messageHandlerTemplate,
    });
      const responseContent = await generateMessageResponse({
        runtime: runtime,
        context,
        modelClass: ModelClass.TEXT_LARGE,
      });

      responseContent.text = responseContent.text?.trim();
      responseContent.inReplyTo = stringToUuid(
        `${message.id}-${runtime.agentId}`
      );

      const responseMessages: Memory[] = [
        {
          id: v4() as UUID,
          userId: runtime.agentId,
          agentId: runtime.agentId,
          content: responseContent,
          roomId: message.roomId,
          createdAt: Date.now(),
        },
      ];

      state = await runtime.updateRecentMessageState(state);

      await runtime.processActions(message, responseMessages, state, callback);
  }

  await runtime.evaluate(message, state, shouldRespond);
};

const reactionReceivedHandler = async ({
  runtime,
  message,
}: {
  runtime: IAgentRuntime;
  message: Memory;
}) => {
  try {
    await runtime.messageManager.createMemory(message);
  } catch (error) {
    if (error.code === "23505") {
      logger.warn("Duplicate reaction memory, skipping");
      return;
    }
    logger.error("Error in reaction handler:", error);
  }
};

export const messageEvents = {
  MESSAGE_RECEIVED: [
    async ({ runtime, message, callback }: MessageReceivedHandlerParams) => {
      await messageReceivedHandler({
        runtime,
        message,
        callback,
      });
    },
  ],
  VOICE_MESSAGE_RECEIVED: [
    async ({ runtime, message, callback }: MessageReceivedHandlerParams) => {
      await messageReceivedHandler({
        runtime,
        message,
        callback,
      });
    },
  ],
  REACTION_RECEIVED: [reactionReceivedHandler],
};
