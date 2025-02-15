import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";

export const cancelTaskAction: Action = {
  name: "CANCEL_TASK",
  similes: ["REJECT_TASK", "STOP_TASK", "NEVERMIND", "CANCEL", "ABORT"],
  description: "Cancels a pending task that's awaiting confirmation",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ): Promise<boolean> => {
    const pendingTasks = runtime.getTasks({
      roomId: message.roomId,
      tags: ["AWAITING_CONFIRMATION"],
  });

  // Only validate if there are pending tasks
  return pendingTasks && pendingTasks.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
    responses: Memory[]
  ): Promise<void> => {
    try {
      // First handle any initial responses
      for (const response of responses) {
        await callback(response.content);
      }

      // Get pending tasks for this room
      const pendingTasks = runtime.getTasks({
        roomId: message.roomId,
        tags: ["AWAITING_CONFIRMATION"],
      });

      if (!pendingTasks || pendingTasks.length === 0) {
        await callback({
          text: "No tasks currently awaiting confirmation.",
          action: "CANCEL_TASK",
          source: message.content.source,
        });
        return;
      }

      // Cancel each pending task
      for (const task of pendingTasks) {
        runtime.deleteTask(task.id);
      }

      await callback({
        text: "Task cancelled successfully.",
        action: "CANCEL_TASK",
        source: message.content.source,
      });
    } catch (error) {
      logger.error("Error in cancel task handler:", error);
      await callback({
        text: "There was an error cancelling the task.",
        action: "CANCEL_TASK",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Actually, don't post that tweet",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Task cancelled successfully.",
          action: "CANCEL_TASK",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Cancel",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Task cancelled successfully.",
          action: "CANCEL_TASK",
        },
      },
    ],
  ] as ActionExample[][],
};
