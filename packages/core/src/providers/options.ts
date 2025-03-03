import { logger } from "../logger";
import type { IAgentRuntime, Memory, Provider, State } from "../types";

// Define an interface for option objects
interface OptionObject {
  name: string;
  description?: string;
}

export const optionsProvider: Provider = {
    name: "options",
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            // Get all pending tasks for this room with options
            const pendingTasks = await runtime.databaseAdapter.getTasks({
                roomId: message.roomId,
                tags: ["AWAITING_CHOICE"]
            });

            if (!pendingTasks || pendingTasks.length === 0) {
                return "";
            }

            // Filter tasks that have options
            const tasksWithOptions = pendingTasks.filter(task => task.metadata?.options);
            
            if (tasksWithOptions.length === 0) {
                return "";
            }
            // Format tasks into a readable list
            let output = "# Pending Tasks\n\n";
            output += "The following tasks are awaiting your selection:\n\n";

            tasksWithOptions.forEach((task, index) => {
                output += `${index + 1}. **${task.name}**\n`;
                if (task.description) {
                    output += `   ${task.description}\n`;
                }
                
                // List available options
                if (task.metadata?.options) {
                    output += "   Options:\n";
                    
                    // Handle both string[] and OptionObject[] formats
                    const options = task.metadata.options as string[] | OptionObject[];
                    
                    options.forEach(option => {
                        if (typeof option === 'string') {
                            // Handle string option
                            const description = task.metadata?.options.find(o => o.name === option)?.description || '';
                            output += `   - \`${option}\` ${description ? `- ${description}` : ''}\n`;
                        } else {
                            // Handle option object
                            output += `   - \`${option.name}\` ${option.description ? `- ${option.description}` : ''}\n`;
                        }
                    });
                }
                output += "\n";
            });

            output += "To select an option, reply with the option name (e.g., 'post' or 'cancel').\n";

            return output.trim();
        } catch (error) {
            logger.error("Error in options provider:", error);
            return "Error retrieving pending tasks with options.";
        }
    }
};

export default optionsProvider;