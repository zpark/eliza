import { type IAgentRuntime, logger, stringToUuid } from "@elizaos/core";
import { initializeRoleState } from "./initialize";
import { ONBOARDING_CACHE_KEY, type OnboardingState, OWNERSHIP_CACHE_KEY } from "./types";
import { getOrCreateOwnershipState, normalizeUserId, recoverStateFromDiscord } from "../ownership/core";

export interface ServerOwnership {
    ownerId: string;
    serverId: string;
    agentId: string;
}

export interface ServerOwnershipState {
    servers: {
        [serverId: string]: ServerOwnership;
    };
}

export async function registerServerOwner(
    runtime: IAgentRuntime,
    serverId: string,
    ownerId: string
  ): Promise<void> {
    try {
      if (!serverId) {
        throw new Error('Server ID is required');
      }
      
      if (!ownerId) {
        throw new Error('Owner ID is required');
      }
  
      // Log the parameters to help with debugging
      logger.info(`Registering owner for server ${serverId}`);
      logger.info(`Owner ID: ${ownerId}`);
      
      let ownershipState = await runtime.cacheManager.get<ServerOwnershipState>(
        OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE
      );
      
      if (!ownershipState) {
        ownershipState = {
          servers: {},
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
      };
    
      await runtime.cacheManager.set(
        OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE, 
        ownershipState
      );
      
      // Log the registration
      logger.info(`Successfully registered owner ${ownerId} for server ${serverId}`);
    } catch (error) {
      logger.error(`Error registering server owner: ${error.message}`, {
        serverId,
        ownerId,
        error
      });
      throw error;
    }
  }

  export interface ServerOwnership {
      ownerId: string;
      serverId: string;
      agentId: string;
  }
  
  export interface ServerOwnershipState {
      servers: {
          [serverId: string]: ServerOwnership;
      };
  }

// Validate onboarding access based on ownership
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

        const onboardingCacheKey = ONBOARDING_CACHE_KEY.SERVER_STATE(serverOwnership.serverId);

        // Check for active onboarding
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            onboardingCacheKey
        );

        if (!onboardingState) {
            throw new Error(`No onboarding state found for server ${serverOwnership.serverId}`);
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

/**
 * Ensures ownership state exists and the server is registered
 * This is useful as a safety check before any role operations
 */
export async function ensureOwnershipState(
  runtime: IAgentRuntime,
  serverId: string,
  ownerId?: string
): Promise<boolean> {
  try {
    if (!serverId) {
      logger.error('Server ID is required for ownership verification');
      return false;
    }
    
    let ownershipState = await runtime.cacheManager.get(
      OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE
    ) as { servers: { [key: string]: { ownerId: string } } };
    
    // Create initial state if not exists
    if (!ownershipState) {
      ownershipState = { 
        servers: {
          [serverId]: {
            ownerId,
          }
        },
      };
    }

    // If server not in ownership state and we have an owner ID, register it
    if (!ownershipState.servers[serverId] && ownerId) {
      ownershipState.servers[serverId] = {
        ownerId,
      };
      
      await runtime.cacheManager.set(
        OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
        ownershipState
      );
      
      logger.info(`Added server ${serverId} to ownership state with owner ${ownerId}`);
      
      // Also initialize role state
      await initializeRoleState(runtime, serverId, ownerId);
      return true;
    }
    
    // If server already in ownership state, verify it
    if (ownershipState.servers[serverId]) {
      // Optional update of ownerId if provided and different
      if (ownerId && ownershipState.servers[serverId].ownerId !== ownerId) {
        ownershipState.servers[serverId].ownerId = ownerId;
        
        await runtime.cacheManager.set(
          OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
          ownershipState
        );
        
        logger.info(`Updated owner for server ${serverId} to ${ownerId}`);
      }
      
      return true;
    }
    
    logger.warn(`No ownership record found for server ${serverId} and no owner ID provided`);
    return false;
  } catch (error) {
    logger.error(`Error ensuring ownership state: ${error}`);
    return false;
  }
}

export interface ServerOwnership {
    ownerId: string;
    serverId: string;
    agentId: string;
}

export interface ServerOwnershipState {
    servers: {
        [serverId: string]: ServerOwnership;
    };
}

export async function findServerForOwner(
  runtime: IAgentRuntime,
  userId: string
): Promise<ServerOwnership | null> {
  try {
    if (!userId) {
      logger.error('User ID is required to find server');
      return null;
    }
    
    const normalizedUserId = normalizeUserId(userId);
    logger.info(`Looking for server where ${normalizedUserId} is owner (original ID: ${userId})`);
    
    const ownershipState = await getOrCreateOwnershipState(runtime);
    logger.info(`Current ownership state has ${Object.keys(ownershipState.servers || {}).length} servers`);
    
    // Debug: Log all server owners for inspection
    if (ownershipState.servers) {
      for (const [serverId, info] of Object.entries(ownershipState.servers)) {
        logger.info(`Server ${serverId} has owner ${info.ownerId}`);
      }
    }
    
    // Empty state check with recovery attempt
    if (!ownershipState.servers || Object.keys(ownershipState.servers).length === 0) {
      logger.info('No servers found in ownership state');
      const recovered = await recoverStateFromDiscord(runtime);
      if (recovered) {
        return findServerForOwner(runtime, userId); // Retry after recovery
      }
      return null;
    }
    
    // First try to find by normalized ID (preferred method)
    for (const [serverId, server] of Object.entries(ownershipState.servers)) {
      if (!server.ownerId) continue; // Skip invalid entries
      
      const ownerUuid = normalizeUserId(server.ownerId);
      logger.debug(`Comparing server ${serverId} owner ${ownerUuid} to user ${normalizedUserId}`);
      
      if (ownerUuid === normalizedUserId) {
        logger.info(`Found server ${serverId} for owner ${normalizedUserId}`);
        return {
          ...server,
          ownerId: ownerUuid, // Ensure consistent return format
          serverId
        };
      }
    }
    
    // Fallback - try to find by original ID
    for (const [serverId, server] of Object.entries(ownershipState.servers)) {
      if (!server.ownerId) continue;
      
      if (server.ownerId === userId) {
        logger.info(`Found server ${serverId} for owner ${userId} using original ID`);
        return {
          ...server,
          serverId
        };
      }
    }
    
    // Try one more method - direct string comparison ignoring format
    for (const [serverId, server] of Object.entries(ownershipState.servers)) {
      if (!server.ownerId) continue;
      
      // Strip any non-alphanumeric characters for comparison
      const strippedOwnerId = server.ownerId.replace(/[^a-zA-Z0-9]/g, '');
      const strippedUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
      
      if (strippedOwnerId === strippedUserId) {
        logger.info(`Found server ${serverId} for owner ${userId} using string comparison`);
        return {
          ...server,
          serverId
        };
      }
    }
    
    logger.info(`No server found for owner ${normalizedUserId}`);
    return null;
  } catch (error) {
    logger.error(`Error finding server for owner: ${error}`);
    return null;
  }
}