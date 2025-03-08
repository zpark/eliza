import {
    elizaLogger,
    Evaluator,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@elizaos/core";
import { extractAndValidateConfiguration } from "../../actions/meteora/managePositions";

export const meteoraManagePositionActionRetriggerEvaluator: Evaluator = {
    name: "DEGEN_LP_METEORA_REPOSITION_EVALUATOR",
    similes: ["DEGEN_LP_METEORA_REPOSITION"],
    alwaysRun: true,
    description: "Schedules and monitors ongoing repositioning actions for Meteora positions.",
    
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => true,

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Checking Meteora LP position status");
        
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        }

        const config = await extractAndValidateConfiguration(message.content.text, runtime);
        if (!config?.intervalSeconds) {
            elizaLogger.debug("Invalid or missing intervalSeconds configuration");
            return;
        }

        const intervalMs = config.intervalSeconds * 1000;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));

        await runtime.databaseAdapter.createMemory({
            content: {
                text: message.content.text,
            },
            agentId: runtime.agentId,
            roomId: runtime.agentId,
            userId: runtime.agentId,
            metadata: {
                type: "meteora_reposition_message",
            }
        }, "meteora_reposition_message");
    },
    examples: [],
}; 