import { type IAgentRuntime, logger, type State } from "@elizaos/core";
import type { OnboardingState } from "./types";
import type { Message } from "discord.js";

export interface ServerOwnership {
    ownerId: string;
    serverId: string;
    agentId: string;
    lastUpdated: number;
}

export interface ServerOwnershipState {
    servers: {
        [serverId: string]: ServerOwnership;
    };
    lastUpdated: number;
}

const OWNERSHIP_CACHE_KEY = 'server_ownership_state';

export async function registerServerOwner(
    runtime: IAgentRuntime,
    serverId: string,
    ownerId: string
): Promise<void> {
    try {
        let ownershipState = await runtime.cacheManager.get<ServerOwnershipState>(OWNERSHIP_CACHE_KEY);
        
        if (!ownershipState) {
            ownershipState = {
                servers: {},
                lastUpdated: Date.now()
            };
        }

        // Ensure servers object exists
        if (!ownershipState.servers) {
            ownershipState.servers = {};
        }

        ownershipState.servers[serverId] = {
            ownerId,
            serverId,
            agentId: runtime.agentId,
            lastUpdated: Date.now()
        };

        ownershipState.lastUpdated = Date.now();

        await runtime.cacheManager.set(OWNERSHIP_CACHE_KEY, ownershipState);
        
        // Log the registration
        logger.info(`Registered owner ${ownerId} for server ${serverId}`);
        
        // Also initialize an empty onboarding state if it doesn't exist
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverId}_onboarding_state`
        );
        
        if (!onboardingState) {
            await runtime.cacheManager.set(
                `server_${serverId}_onboarding_state`,
                {}
            );
        }
    } catch (error) {
        logger.error('Error registering server owner:', error);
        throw error;
    }
}

// In onboarding/ownership.ts, modify findServerForOwner:
export async function findServerForOwner(
    runtime: IAgentRuntime,
    state?: State
): Promise<ServerOwnership | null> {
    try {
        const ownershipState = await runtime.cacheManager.get<ServerOwnershipState>(OWNERSHIP_CACHE_KEY);
        if (!ownershipState?.servers) {
            return null;
        }

        // Get the Discord message from passed state
        if (!state?.discordMessage) {
            return null;
        }
        const discordMessage = state.discordMessage as Message;
        const discordUserId = discordMessage?.author?.id;

        if (!discordUserId) {
            return null;
        }

        // Find server where this user is owner using the Discord ID
        const serverOwnership = Object.values(ownershipState.servers).find(server => 
            server.ownerId === discordUserId
        );

        return serverOwnership || null;
    } catch (error) {
        logger.error('Error finding server for owner:', error);
        return null;
    }
}

// Validate onboarding access based on ownership
export async function validateOnboardingAccess(
    runtime: IAgentRuntime,
    userId: string
): Promise<{ serverId: string, onboardingState: OnboardingState } | null> {
    try {
        // Find server where user is owner
        const serverOwnership = await findServerForOwner(runtime);
        
        if (!serverOwnership) {
            return null;
        }

        // Check for active onboarding
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverOwnership.serverId}_onboarding_state`
        );

        if (!onboardingState) {
            return null;
        }

        return {
            serverId: serverOwnership.serverId,
            onboardingState
        };
    } catch (error) {
        logger.error('Error validating onboarding access:', error);
        return null;
    }
}