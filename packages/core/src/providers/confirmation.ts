import { logger } from "../logger";
import { IAgentRuntime, Memory, Provider, State } from "../types";

export const confirmationTasksProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            // Get all pending tasks for this room
            const pendingTasks = runtime.getTasks({
                roomId: message.roomId,
                tags: ["AWAITING_CONFIRMATION"]
            });

            if (!pendingTasks || pendingTasks.length === 0) {
                return "";
            }

            // Format tasks into a readable list
            let output = "# Pending Tasks\n\n";
            output += "The following tasks are awaiting confirmation:\n\n";

            pendingTasks.forEach((task, index) => {
                output += `${index + 1}. **${task.name}**\n`;
                if (task.description) {
                    output += `   ${task.description}\n`;
                }
                output += "\n";
            });

            output += "To confirm a task, say 'confirm' or 'approve'.\n";
            output += "To cancel a task, say 'cancel' or 'reject'.\n";

            return output.trim();
        } catch (error) {
            logger.error("Error in confirmation tasks provider:", error);
            return "Error retrieving pending tasks.";
        }
    }
};

export default confirmationTasksProvider;