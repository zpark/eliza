import { composeContext } from "../context";
import { logger } from "../logger";
import { parseJSONObjectFromText } from "../parsing";
import { getUserServerRole } from "../roles";
import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  type State,
} from "../types";

const optionExtractionTemplate = `# Task: Extract selected task and option from user message

# Available Tasks:
{{#each tasks}}
Task {{taskId}}: {{name}}
Available options:
{{#each options}}
- {{name}}: {{description}}
{{/each}}
- ABORT: Cancel this task

{{/each}}

# Recent Messages:
{{recentMessages}}

# Instructions:
1. Review the user's message and identify which task and option they are selecting
2. Match against the available tasks and their options, including ABORT
3. Return the task ID and selected option name exactly as listed above
4. If no clear selection is made, return null for both fields

Return in JSON format:
\`\`\`json
{
  "taskId": number | null,
  "selectedOption": "OPTION_NAME" | null
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.`;

export const choiceAction: Action = {
  name: "CHOOSE_OPTION",
  similes: ["SELECT_OPTION", "SELECT", "PICK", "CHOOSE"],
  description: "Selects an option for a pending task that has multiple options",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    // Get all tasks with options metadata
    const pendingTasks = runtime.databaseAdapter.getTasks({
      roomId: message.roomId,
      tags: ["AWAITING_CHOICE"],
    });

    const room = await runtime.databaseAdapter.getRoom(message.roomId);

    const userRole = await getUserServerRole(
      runtime,
      message.userId,
      room.serverId
    );

    if (userRole !== "OWNER" && userRole !== "ADMIN") {
      return false;
    }

    // Only validate if there are pending tasks with options
    return (
      pendingTasks &&
      pendingTasks.length > 0 &&
      pendingTasks.some((task) => task.metadata?.options)
    );
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

      const pendingTasks = runtime.databaseAdapter.getTasks({
        roomId: message.roomId,
        tags: ["AWAITING_CHOICE"],
      });

      if (!pendingTasks?.length) {
        await callback({
          text: "No tasks currently awaiting options selection.",
          action: "CHOOSE_OPTION",
          source: message.content.source,
        });
        return;
      }

      const tasksWithOptions = pendingTasks.filter(
        (task) => task.metadata?.options
      );

      if (!tasksWithOptions.length) {
        await callback({
          text: "No tasks currently have options to select from.",
          action: "CHOOSE_OPTION",
          source: message.content.source,
        });
        return;
      }

      // Format tasks with their options for the LLM
      const formattedTasks = tasksWithOptions.map((task, index) => ({
        taskId: index + 1,
        name: task.name,
        options: task.metadata.options.map(opt => ({
          name: typeof opt === 'string' ? opt : opt.name,
          description: typeof opt === 'string' ? opt : opt.description || opt.name
        }))
      }));

      const context = composeContext({
        state: {
          ...state,
          tasks: formattedTasks,
          recentMessages: message.content.text
        },
        template: optionExtractionTemplate
      });

      const result = await runtime.useModel(ModelClass.TEXT_SMALL, {
        context,
        stopSequences: []
      });

      const parsed = parseJSONObjectFromText(result);
      const { taskId, selectedOption } = parsed;

      if (taskId && selectedOption) {
        const selectedTask = tasksWithOptions[taskId - 1];
        
        if (selectedOption === 'ABORT') {
          runtime.deleteTask(selectedTask.id);
          await callback({
            text: `Task "${selectedTask.name}" has been cancelled.`,
            action: "CHOOSE_OPTION",
            source: message.content.source,
          });
          return;
        }

        try {
          await selectedTask.handler(runtime, { option: selectedOption });
          runtime.deleteTask(selectedTask.id);
          await callback({
            text: `Selected option: ${selectedOption} for task: ${selectedTask.name}`,
            action: "CHOOSE_OPTION",
            source: message.content.source,
          });
          return;
        } catch (error) {
          logger.error("Error executing task with option:", error);
          await callback({
            text: "There was an error processing your selection.",
            action: "SELECT_OPTION_ERROR",
            source: message.content.source,
          });
          return;
        }
      }

      // If no task/option was selected, list available options
      let optionsText = "Please select a valid option from one of these tasks:\n\n";
      tasksWithOptions.forEach((task, index) => {
        optionsText += `${index + 1}. **${task.name}**:\n`;
        const options = task.metadata.options.map(opt => 
          typeof opt === 'string' ? opt : opt.name
        );
        options.push('ABORT');
        optionsText += options.map(opt => `- ${opt}`).join('\n');
        optionsText += '\n\n';
      });

      await callback({
        text: optionsText,
        action: "SELECT_OPTION_INVALID",
        source: message.content.source,
      });

    } catch (error) {
      logger.error("Error in select option handler:", error);
      await callback({
        text: "There was an error processing the option selection.",
        action: "SELECT_OPTION_ERROR",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "post",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Selected option: post for task: Confirm Twitter Post",
          action: "CHOOSE_OPTION",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "I choose cancel",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Selected option: cancel for task: Confirm Twitter Post",
          action: "CHOOSE_OPTION",
        },
      },
    ],
  ] as ActionExample[][],
};

export default choiceAction;
