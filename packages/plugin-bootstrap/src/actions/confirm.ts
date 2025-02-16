import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";

export const confirmTaskAction: Action = {
  name: "CONFIRM_TASK",
  similes: ["APPROVE_TASK", "EXECUTE_TASK", "PROCEED", "GO_AHEAD", "CONFIRM"],
  description:
    "Confirms and executes a pending task that's awaiting confirmation",

    validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State
  ): Promise<boolean> => {
      // Get all tasks with AWAITING_CONFIRMATION tag
      const pendingTasks = runtime.getTasks({});
  
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
          action: "CONFIRM_TASK",
          source: message.content.source,
        });
        return;
      }

      // Process each pending task
      for (const task of pendingTasks) {
        try {
          // Execute the task handler
          await task.handler(runtime);

          // Delete the task after successful execution
          runtime.deleteTask(task.id);
        } catch (error) {
          logger.error("Error executing task:", error);
          await callback({
            text: "There was an error executing the task.",
            action: "CONFIRM_TASK_ERROR",
            source: message.content.source,
          });
        }
      }
    } catch (error) {
      logger.error("Error in confirm task handler:", error);
      await callback({
        text: "There was an error processing the task confirmation.",
        action: "CONFIRM_TASK_ERROR",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Yes, go ahead and post that tweet",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Task confirmed and executed successfully!",
          action: "CONFIRM_TASK",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Confirm",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Task confirmed and executed successfully!",
          action: "CONFIRM_TASK",
        },
      },
    ],
  ] as ActionExample[][],
};
