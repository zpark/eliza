import {
    ChannelType,
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { ROLE_CACHE_KEYS, ServerRoleState } from "../role/types";
import { OWNERSHIP_CACHE_KEY } from "../onboarding/types";

export const roleProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        const room = await runtime.getRoom(message.roomId);
        if(!room) {
            throw new Error("No room found");
        }

        if (room.type !== ChannelType.GROUP) {
            return "No access to role information in DMs, the role provider is only available in group scenarios.";
        }

        const serverId = room.serverId;

        if (!serverId) {
            throw new Error("No server ID found");
        }

        try {
            logger.info(`Using server ID: ${serverId}`);

            // First check if ownership state exists
            const ownershipState = await runtime.cacheManager.get(
                OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE
            ) as { servers: { [key: string]: { ownerId: string } } };

            if (!ownershipState?.servers || !Object.keys(ownershipState.servers).includes(serverId)) {
                logger.info(`No ownership state found for server ${serverId}, initializing empty role hierarchy`);
                return "";
            }

            const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
            logger.info(`Looking up roles with cache key: ${cacheKey}`);

            const roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
            
            if (!roleState?.roles) {
                logger.info(`No roles found for server ${serverId}`);
                return "No role information available for this server.";
            }

            logger.info(`Found ${Object.keys(roleState.roles).length} roles`);
            
            // Rest of your existing code...
            // Group users by role
            const owners: string[] = [];
            const managers: string[] = [];
            
            // ...
        } catch (error) {
            logger.error("Error in role provider:", error);
            return ""; // Return empty string on error to avoid breaking the response
        }
    }
};

export default roleProvider;