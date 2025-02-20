// File: /swarm/shared/ownership/core.ts
// Further fix to ensure consistent state access across components

import {
    type IAgentRuntime,
    logger,
    stringToUuid,
    type UUID
  } from "@elizaos/core";
  
  export interface ServerOwnership {
    ownerId: string;  // Always stored normalized
    serverId: string;
    agentId: string;
  }
  
  export interface ServerOwnershipState {
    servers: {
      [serverId: string]: ServerOwnership;
    };
  }
  
  export const OWNERSHIP_CACHE_KEY = {
    SERVER_OWNERSHIP_STATE: 'server_ownership_state',
  } as const;
  
  /**
   * Normalizes user IDs to UUID format
   * Both stringToUuid and direct values are supported for robustness
   */
  export function normalizeUserId(id: string): string {
    // Avoid double-conversion by checking if already a UUID format
    if (id.includes('-') && id.length === 36) {
      return id;
    }
    return stringToUuid(id);
  }
  
  // Track the ownership state globally to prevent recreation
  let cachedOwnershipState: ServerOwnershipState | null = null;
  
  /**
   * Gets or creates ownership state with caching to prevent duplicates
   * Exposed as singleton to ensure state consistency
   */
  export async function getOrCreateOwnershipState(
    runtime: IAgentRuntime
  ): Promise<ServerOwnershipState> {
    try {
      // First, check our in-memory cache to avoid multiple lookups/creates
      if (cachedOwnershipState) {
        logger.info('Using cached ownership state');
        return cachedOwnershipState;
      }
  
      // If not in memory, try to get from cache manager
      const ownershipState = await runtime.cacheManager.get<ServerOwnershipState>(
        OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE
      );
      
      if (ownershipState?.servers) {
        logger.info(`Retrieved existing ownership state with ${Object.keys(ownershipState.servers).length} servers`);
        cachedOwnershipState = ownershipState;
        return ownershipState;
      }
      
      // Create new state if not found
      const newState: ServerOwnershipState = { servers: {} };
      await runtime.cacheManager.set(
        OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
        newState
      );
      
      logger.info('Created new ownership state');
      cachedOwnershipState = newState;
      return newState;
    } catch (error) {
      logger.error(`Error getting/creating ownership state: ${error}`);
      // Fallback to empty state if error occurs
      const fallbackState = { servers: {} };
      cachedOwnershipState = fallbackState;
      return fallbackState;
    }
  }
  
  /**
   * Updates ownership state atomically with retry mechanism
   * Ensures in-memory cache is also updated
   */
  export async function updateOwnershipState(
    runtime: IAgentRuntime,
    updateFn: (currentState: ServerOwnershipState) => ServerOwnershipState,
    retries = 3
  ): Promise<ServerOwnershipState> {
    let attempts = 0;
    
    while (attempts < retries) {
      try {
        const currentState = await getOrCreateOwnershipState(runtime);
        const newState = updateFn({...currentState});
        
        // Save to persistent cache
        await runtime.cacheManager.set(
          OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
          newState
        );
        
        // Update the cached version
        cachedOwnershipState = newState;
        return newState;
      } catch (error) {
        attempts++;
        if (attempts >= retries) {
          logger.error(`Failed to update ownership state after ${retries} attempts: ${error}`);
          throw new Error(`Failed to update ownership state: ${error.message}`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempts));
      }
    }
    
    throw new Error('Unexpected error updating ownership state');
  }
  
  /**
   * Registers a server owner with consistent ID normalization
   */
  export async function registerServerOwner(
    runtime: IAgentRuntime,
    serverId: string,
    ownerId: string
  ): Promise<void> {
    if (!serverId || !ownerId) {
      throw new Error('Server ID and Owner ID are required');
    }
    
    const normalizedOwnerId = normalizeUserId(ownerId);
    
    logger.info(`Registering owner for server ${serverId}`);
    logger.info(`Original Owner ID: ${ownerId}, Normalized: ${normalizedOwnerId}`);
    
    await updateOwnershipState(runtime, (currentState) => {
      const updatedState = {...currentState};
      if (!updatedState.servers) {
        updatedState.servers = {};
      }
      
      // Store using normalized ID for consistency
      updatedState.servers[serverId] = {
        ownerId: normalizedOwnerId,
        serverId,
        agentId: runtime.agentId
      };
      
      return updatedState;
    });
    
    logger.info(`Successfully registered owner ${normalizedOwnerId} for server ${serverId}`);
  }
  
  /**
   * Recovery mechanism to populate state from Discord if missing
   */
  export async function recoverStateFromDiscord(runtime: IAgentRuntime): Promise<boolean> {
    try {
      // Try to populate from Discord
      const discordClient = runtime.getClient("discord")?.client;
      if (!discordClient) {
        logger.error('Discord client not available for recovery');
        return false;
      }
      
      try {
        const guilds = await discordClient.guilds.fetch();
        if (!guilds || guilds.size === 0) {
          logger.info('No Discord guilds available for recovery');
          return false;
        }
        
        // Process guilds to rebuild state
        let updatedAny = false;
        const stateUpdates: {[serverId: string]: ServerOwnership} = {};
        
        for (const [guildId, guildPartial] of guilds) {
          try {
            const guild = await guildPartial.fetch();
            if (guild.ownerId) {
              const normalizedOwnerId = normalizeUserId(guild.ownerId);
              stateUpdates[guild.id] = {
                ownerId: normalizedOwnerId,
                serverId: guild.id,
                agentId: runtime.agentId
              };
              updatedAny = true;
              logger.info(`Recovered server ${guild.id} with owner ${guild.ownerId} (normalized: ${normalizedOwnerId})`);
            }
          } catch (e) {
            logger.error(`Error processing guild ${guildId} during recovery: ${e}`);
          }
        }
        
        if (updatedAny) {
          // Update ownership state with all recovered guilds at once
          await updateOwnershipState(runtime, (currentState) => {
            const updatedState = {...currentState};
            if (!updatedState.servers) {
              updatedState.servers = {};
            }
            
            // Add all recovered servers
            for (const [serverId, serverInfo] of Object.entries(stateUpdates)) {
              updatedState.servers[serverId] = serverInfo;
            }
            
            return updatedState;
          });
          
          logger.info(`Recovered ${Object.keys(stateUpdates).length} servers into ownership state`);
          return true;
        }
        
        return false;
      } catch (e) {
        logger.error(`Failed to recover ownership state from Discord: ${e}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error in recovery process: ${error}`);
      return false;
    }
  }

  /**
   * Validates if a user has access to a server based on ownership
   */
  export async function validateOwnershipAccess(
    runtime: IAgentRuntime,
    userId: string,
    serverId: string
  ): Promise<boolean> {
    try {
      const normalizedUserId = normalizeUserId(userId);
      const ownershipState = await getOrCreateOwnershipState(runtime);
      
      if (!ownershipState.servers) {
        return false;
      }
      
      const serverInfo = ownershipState.servers[serverId];
      if (!serverInfo) return false;
      
      const normalizedOwnerId = normalizeUserId(serverInfo.ownerId);
      return normalizedOwnerId === normalizedUserId;
    } catch (error) {
      logger.error(`Error validating ownership access: ${error}`);
      return false;
    }
  }
  
  /**
   * Clears the cached ownership state (useful for testing/debugging)
   */
  export function clearOwnershipCache(): void {
    cachedOwnershipState = null;
    logger.info('Cleared ownership cache');
  }
  
  /**
   * Directly sets the ownership state (for migrations/testing)
   */
  export async function setOwnershipState(
    runtime: IAgentRuntime, 
    state: ServerOwnershipState
  ): Promise<void> {
    await runtime.cacheManager.set(
      OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
      state
    );
    cachedOwnershipState = state;
    logger.info(`Manually set ownership state with ${Object.keys(state.servers).length} servers`);
  }