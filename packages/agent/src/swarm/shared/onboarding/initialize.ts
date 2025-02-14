// src/shared/onboarding/initialize.ts
import { logger, UUID, type IAgentRuntime } from "@elizaos/core";
import { Client } from "discord.js";
import { ROLE_CACHE_KEYS, RoleName, ServerRoleState, UserRole } from "../role/types";
import { type OnboardingConfig, type OnboardingState } from "./types";

export async function setUserServerRole(
    runtime: IAgentRuntime,
    userRole: UserRole
): Promise<void> {
    try {
        const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(userRole.serverId);
        let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);

        if (!roleState) {
            roleState = {
                roles: {},
                lastUpdated: Date.now()
            };
        }

        roleState.roles[userRole.userId] = userRole;
        roleState.lastUpdated = Date.now();

        await runtime.cacheManager.set(
            cacheKey,
            roleState
        );

        // Log role change
        await runtime.databaseAdapter.log({
            body: {
                type: "role_update",
                targetUser: userRole.userId,
                serverId: userRole.serverId,
                newRole: userRole.role,
            },
            userId: runtime.agentId,
            roomId: userRole.serverId as UUID,
            type: "role_management"
        });
    } catch (error) {
        logger.error("Error setting user role:", error);
        throw error;
    }
}

export async function initializeOnboarding(
    runtime: IAgentRuntime, 
    serverId: string, 
    config: OnboardingConfig
): Promise<void> {
    try {
        console.log("*** initializeOnboarding", runtime)
        // Check if onboarding is already initialized
        const existingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverId}_onboarding_state`
        );

        console.log("*** existingState", existingState)

        if (existingState) {
            logger.info(`Onboarding already initialized for server ${serverId}`);
            return;
        }

        console.log("*** initializing onboarding")

        // Initialize onboarding state with config settings
        const initialState: OnboardingState = {
            settings: Object.entries(config.settings).reduce((acc, [key, setting]) => ({
                ...acc,
                [key]: {
                    ...setting,
                    value: null
                }
            }), {}),
            lastUpdated: Date.now(),
            completed: false
        };

        console.log("*** initialState", initialState)

        // Save initial state
        await runtime.cacheManager.set(
            `server_${serverId}_onboarding_state`,
            initialState
        );

        console.log("*** saved initialState")

        // Cache the config for reference
        await runtime.cacheManager.set(
            `server_${serverId}_onboarding_config`,
            config
        );

        // Get Discord client and server info
        const discordClient = (runtime.getClient("discord") as any).client as Client;
        console.log("discordClient", discordClient)
        console.log("guilds", discordClient.guilds)
        const guild = await discordClient.guilds.fetch(serverId);
        
        // Set server owner as admin
        const owner = await guild.members.fetch(guild.ownerId);
        console.log("*** owner", owner)
        await setUserServerRole(runtime, {
            userId: owner.id,
            serverId: serverId,
            role: RoleName.OWNER,
        });
        console.log("*** setUserServerRole")

        // Start DM with owner
        const onboardingMessages = [
            "Hi! I need to collect some information to get set up. Is now a good time?",
            "Hey there! I need to configure a few things. Do you have a moment?",
            "Hello! Could we take a few minutes to get everything set up?",
        ];
        
        const randomMessage = onboardingMessages[Math.floor(Math.random() * onboardingMessages.length)];
        await owner.send(randomMessage);
        console.log("*** sent onboarding message")
        
        logger.info(`Initialized onboarding for server ${serverId}`);
    } catch (error) {
        logger.error(`Failed to initialize onboarding for server ${serverId}:`, error);
        throw error;
    }
}

// Helper to check if a user can access onboarding
export async function canAccessOnboarding(
    runtime: IAgentRuntime,
    userId: string,
    serverId: string,
    config: OnboardingConfig
): Promise<boolean> {
    if (!config.roleRequired) {
        return true;
    }

    const roleState = await runtime.cacheManager.get<ServerRoleState>(
        ROLE_CACHE_KEYS.SERVER_ROLES(serverId)
    );

    if (!roleState?.roles[userId]) {
        return false;
    }

    const userRole = roleState.roles[userId].role;
    if (config.roleRequired === RoleName.OWNER) {
        return userRole === RoleName.OWNER;
    }
    if (config.roleRequired === RoleName.ADMIN) {
        return userRole === RoleName.OWNER || userRole === RoleName.ADMIN;
    }
    return true;
}