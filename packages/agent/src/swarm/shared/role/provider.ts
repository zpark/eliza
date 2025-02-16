import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import type { Message } from "discord.js";
import { ServerRoleState, RoleName, ROLE_CACHE_KEYS } from "../role/types";

export const roleProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if(!state?.discordMessage) {
            return "Error: No discord message in state";
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild) {
            return "Error: No guild found";
        }

        try {
            // Fetch fresh guild data
            const guild = await discordMessage.guild.fetch();
            const serverId = guild.id;
            logger.info(`Using server ID: ${serverId}`);

            const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
            logger.info(`Looking up roles with cache key: ${cacheKey}`);

            const roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
            
            if (!roleState?.roles) {
                logger.error(`No roles found for server ${serverId}`);
                return "No role information available for this server.";
            }

            logger.info(`Found ${Object.keys(roleState.roles).length} roles`);

            // Group users by role
            const owners: string[] = [];
            const managers: string[] = [];

            // Fetch all members to get usernames
            const members = await guild.members.fetch();

            for (const [userId, userRole] of Object.entries(roleState.roles)) {
                logger.info(`Processing user ${userId} with role ${userRole.role}`);
                
                // Skip NONE and IGNORE roles
                if (userRole.role === RoleName.NONE) {
                    continue;
                }

                const member = members.get(userId);
                const displayName = member?.displayName || member?.user.username || userId;

                switch (userRole.role) {
                    case RoleName.OWNER:
                        owners.push(displayName);
                        break;
                    case RoleName.ADMIN:
                        managers.push(displayName);
                        break;
                }
            }

            if (owners.length === 0 && managers.length === 0) {
                return "";
            }

            // Build the formatted output
            let output = "## Organizational Hierarchy\n\n";

            if (owners.length > 0) {
                output += "### Owners\n";
                owners.forEach(name => output += `• ${name}\n`);
                output += "\n";
            }

            if (managers.length > 0) {
                output += "### Managers\n";
                managers.forEach(name => output += `• ${name}\n`);
                output += "\n";
            }

            output += "\n";
            return output.trim();

        } catch (error) {
            logger.error("Error in role provider:", error);
            return "Error retrieving role information.";
        }
    }
};

export default roleProvider;