import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import type { Message } from "discord.js";
import { ServerRoleState, RoleName, ROLE_CACHE_KEYS } from "./types";

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

            let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
            
            // Initialize role state if it doesn't exist
            if (!roleState?.roles) {
                logger.info(`No role state found, initializing with owner`);
                roleState = {
                    roles: {
                        [guild.ownerId]: {
                            userId: guild.ownerId,
                            serverId: serverId,
                            role: RoleName.OWNER
                        }
                    },
                    lastUpdated: Date.now()
                };
                
                await runtime.cacheManager.set(cacheKey, roleState);
                logger.info(`Initialized role state with owner ${guild.ownerId}`);
            }

            logger.info(`Found ${Object.keys(roleState.roles).length} roles`);

            // Group users by role
            const owners: string[] = [];
            const managers: string[] = [];
            const colleagues: string[] = [];

            // Fetch all members to get usernames
            const members = await guild.members.fetch();

            for (const [userId, userRole] of Object.entries(roleState.roles)) {
                logger.info(`Processing user ${userId} with role ${userRole.role}`);
                
                // Skip NONE and IGNORE roles
                if (userRole.role === RoleName.NONE || userRole.role === RoleName.IGNORE) {
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
                    case RoleName.MEMBER:
                        colleagues.push(displayName);
                        break;
                }
            }

            // Build the formatted output
            let output = "**Team Structure**\n\n";

            if (owners.length > 0) {
                output += "**Owners**\n";
                owners.forEach(name => output += `• ${name}\n`);
                output += "\n";
            }

            if (managers.length > 0) {
                output += "**Managers**\n";
                managers.forEach(name => output += `• ${name}\n`);
                output += "\n";
            }

            if (colleagues.length > 0) {
                output += "**Colleagues**\n";
                colleagues.forEach(name => output += `• ${name}\n`);
            }

            if (output === "**Team Structure**\n\n") {
                return "No team members found with assigned roles.";
            }

            return output.trim();

        } catch (error) {
            logger.error("Error in role provider:", error);
            return "Error retrieving role information.";
        }
    }
};

export default roleProvider;