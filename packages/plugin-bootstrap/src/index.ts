import {
  composeContext,
  generateMessageResponse,
  generateShouldRespond,
  HandlerCallback,
  logger,
  Memory,
  messageCompletionFooter,
  ModelClass,
  shouldRespondFooter,
  State,
  stringToUuid,
  type IAgentRuntime,
  type Plugin,
  type UUID,
} from "@elizaos/core";
import { v4 } from "uuid";
import { cancelTaskAction } from "./actions/cancel.ts";
import { confirmTaskAction } from "./actions/confirm.ts";
import { followRoomAction } from "./actions/followRoom.ts";
import { ignoreAction } from "./actions/ignore.ts";
import { muteRoomAction } from "./actions/muteRoom.ts";
import { noneAction } from "./actions/none.ts";
import { unfollowRoomAction } from "./actions/unfollowRoom.ts";
import { unmuteRoomAction } from "./actions/unmuteRoom.ts";
import { factEvaluator } from "./evaluators/fact.ts";
import { goalEvaluator } from "./evaluators/goal.ts";
import { confirmationTasksProvider } from "./providers/confirmation.ts";
import { factsProvider } from "./providers/facts.ts";
import { timeProvider } from "./providers/time.ts";
export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const shouldRespondTemplate =
  `# Task: Decide if {{agentName}} should respond.
{{providers}}

About {{agentName}}:
{{bio}}

{{recentMessages}}

# INSTRUCTIONS: Respond with the word RESPOND if {{agentName}} should respond to the message. Respond with STOP if a user asks {{agentName}} to be quiet. Respond with IGNORE if {{agentName}} should ignore the message.
` + shouldRespondFooter;

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
` + messageCompletionFooter;

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
    runtime.agentId
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
  } else {
    console.error("Invalid response from response generateText:", response);
    return false;
  }
};

const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
}: MessageReceivedHandlerParams) => {
  let state = await runtime.composeState(message);

  const shouldRespond = await checkShouldRespond(runtime, message, state);

  await runtime.messageManager.addEmbeddingToMemory(message);
  await runtime.messageManager.createMemory(message);

  if (shouldRespond) {
    const context = composeContext({
      state,
      template:
        runtime.character.templates?.messageHandlerTemplate ||
        messageHandlerTemplate,
    });

    try {
      const responseContent = await generateMessageResponse({
        runtime: runtime,
        context,
        modelClass: ModelClass.TEXT_LARGE,
      });

      responseContent.text = responseContent.text?.trim();
      responseContent.inReplyTo = stringToUuid(
        message.id + "-" + runtime.agentId
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
    } catch (error) {
      throw error;
    }
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

export const bootstrapPlugin: Plugin = {
  name: "bootstrap",
  description: "Agent bootstrap with basic actions and evaluators",
  actions: [
    followRoomAction,
    unfollowRoomAction,
    ignoreAction,
    noneAction,
    muteRoomAction,
    unmuteRoomAction,
    cancelTaskAction,
    confirmTaskAction,
  ],
  evaluators: [factEvaluator, goalEvaluator],
  providers: [timeProvider, factsProvider, confirmationTasksProvider],
};

export default bootstrapPlugin;
