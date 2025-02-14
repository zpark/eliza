// New file: shared/serverOwnership.ts
import { IAgentRuntime, logger } from "@elizaos/core";
import { OnboardingState } from "./types";

export interface ServerOwnership {
    ownerId: string;
    serverId: string;
    agentId: string;  // Track which agent created this record
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

        ownershipState.servers[serverId] = {
            ownerId,
            serverId,
            agentId: runtime.agentId,
            lastUpdated: Date.now()
        };

        ownershipState.lastUpdated = Date.now();

        await runtime.cacheManager.set(OWNERSHIP_CACHE_KEY, ownershipState);
        logger.info(`Registered owner ${ownerId} for server ${serverId}`);
    } catch (error) {
        logger.error('Error registering server owner:', error);
        throw error;
    }
}

export async function findServerForOwner(
    runtime: IAgentRuntime,
    ownerId: string
): Promise<ServerOwnership | null> {
    try {
        const ownershipState = await runtime.cacheManager.get<ServerOwnershipState>(OWNERSHIP_CACHE_KEY);
        
        if (!ownershipState) {
            return null;
        }

        // Find server where this user is owner and the agent is the one who registered it
        const serverOwnership = Object.values(ownershipState.servers).find(server => 
            server.ownerId === ownerId && 
            server.agentId === runtime.agentId
        );

        return serverOwnership || null;
    } catch (error) {
        logger.error('Error finding server for owner:', error);
        return null;
    }
}

// Updated onboarding validation
export async function validateOnboardingAccess(
    runtime: IAgentRuntime,
    userId: string
): Promise<{ serverId: string, onboardingState: OnboardingState } | null> {
    try {
        // Find server where user is owner
        const serverOwnership = await findServerForOwner(runtime, userId);
        
        if (!serverOwnership) {
            return null;
        }

        // Check for active onboarding
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverOwnership.serverId}_onboarding_state`
        );

        if (onboardingState) {
            return {
                serverId: serverOwnership.serverId,
                onboardingState
            };
        }

        return null;
    } catch (error) {
        logger.error('Error validating onboarding access:', error);
        return null;
    }
}