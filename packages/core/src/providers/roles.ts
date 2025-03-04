import { createUniqueUuid } from "../entities";
import { logger } from "../logger";
import { ChannelType, type IAgentRuntime, type Memory, type Provider, type State, type UUID } from "../types";

export const roleProvider: Provider = {
    name: "roles",
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> => {
        const room = await runtime.databaseAdapter.getRoom(message.roomId);
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
            const worldId = createUniqueUuid(runtime, serverId);
            const world = await runtime.databaseAdapter.getWorld(worldId);
            
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
            const owners: { name: string, username: string, names: string[] }[] = [];
            const admins: { name: string, username: string, names: string[] }[] = [];
            const members: { name: string, username: string, names: string[] }[] = [];
            
            // Process roles
            for (const userId in roles) {
                const userRole = roles[userId];

                // get the user from the database
                const user = await runtime.databaseAdapter.getEntityById(userId as UUID);

                const name = user.metadata[room.source]?.name;
                const username = user.metadata[room.source]?.username;
                const names = user.names;
                
                // Skip duplicates (we store both UUID and original ID)
                if (owners.some(owner => owner.username === username) || admins.some(admin => admin.username === username) || members.some(member => member.username === username)) {
                    continue;
                }
                
                // Add to appropriate group
                switch (userRole) {
                    case "OWNER":
                        owners.push({ name, username, names });
                        break;
                    case "ADMIN":
                        admins.push({ name, username, names });
                        break;
                    default:
                        members.push({ name, username, names });
                        break;
                }
            }
            
            // Format the response
            let response = "# Server Role Hierarchy\n\n";
            
            if (owners.length > 0) {
                response += "## Owners\n";
                owners.forEach(owner => {
                    response += `${owner.name} (${owner.names.join(", ")})\n`;
                });
                response += "\n";
            }
            
            if (admins.length > 0) {
                response += "## Administrators\n";
                admins.forEach(admin => {
                    response += `${admin.name} (${admin.names.join(", ")}) (${admin.username})\n`;
                });
                response += "\n";
            }
            
            if (members.length > 0) {
                response += "## Members\n";
                members.forEach(member => {
                    response += `${member.name} (${member.names.join(", ")}) (${member.username})\n`;
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