
import { type IAgentRuntime, logger } from "@elizaos/core";
import updateOrgRoleAction from "./action";
import { roleProvider } from "./provider";

export async function initializeRole(
    runtime: IAgentRuntime, 
): Promise<void> {
    try {
        runtime.registerAction(updateOrgRoleAction);
        runtime.registerProvider(roleProvider);
    } catch (error) {
        logger.error(`Error initializing role: ${error}`);
        throw error;
    }
}