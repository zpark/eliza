import { logger } from "../logger";
import { Provider, IAgentRuntime, Memory, State, ChannelType } from "../types";
import { stringToUuid } from "../uuid";

export const roleProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
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

            // Get world data instead of using cache
            const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
            const world = await runtime.getWorld(worldId);
            
            if (!world || !world.metadata?.ownership?.ownerId) {
                logger.info(`No ownership data found for server ${serverId}, initializing empty role hierarchy`);
                return "";
            }

            // Get roles from world metadata
            const roles = world.metadata.roles || {};
            
            if (Object.keys(roles).length === 0) {
                logger.info(`No roles found for server ${serverId}`);
                return "No role information available for this server.";
            }

            logger.info(`Found ${Object.keys(roles).length} roles`);
            
            // Group users by role
            const owners: string[] = [];
            const admins: string[] = [];
            const members: string[] = [];
            
            // Process roles
            for (const userId in roles) {
                console.log('**** checking role for userId', userId);
                console.log(roles[userId]);
                const userRole = roles[userId].role;
                const username = userId; // Use ID as fallback
                
                // Skip duplicates (we store both UUID and original ID)
                if (owners.includes(username) || admins.includes(username) || members.includes(username)) {
                    continue;
                }
                
                // Add to appropriate group
                switch (userRole) {
                    case "OWNER":
                        owners.push(username);
                        break;
                    case "ADMIN":
                        admins.push(username);
                        break;
                    default:
                        members.push(username);
                        break;
                }
            }
            
            // Format the response
            let response = "# Server Role Hierarchy\n\n";
            
            if (owners.length > 0) {
                response += "## Owners\n";
                owners.forEach(owner => {
                    response += `- ${owner}\n`;
                });
                response += "\n";
            }
            
            if (admins.length > 0) {
                response += "## Administrators\n";
                admins.forEach(admin => {
                    response += `- ${admin}\n`;
                });
                response += "\n";
            }
            
            if (members.length > 0) {
                response += "## Members\n";
                members.forEach(member => {
                    response += `- ${member}\n`;
                });
            }
            
            return response;
        } catch (error) {
            logger.error("Error in role provider:", error);
            return ""; // Return empty string on error to avoid breaking the response
        }
    }
};

export default roleProvider;