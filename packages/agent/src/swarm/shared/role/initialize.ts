
import { IAgentRuntime, logger } from "@elizaos/core";
import updateOrgRoleAction from "./action";

export async function initializeRole(
    runtime: IAgentRuntime, 
): Promise<void> {
    try {
        runtime.registerAction(updateOrgRoleAction);
    } catch (error) {
        logger.error(`Error initializing role: ${error}`);
        throw error;
    }
}