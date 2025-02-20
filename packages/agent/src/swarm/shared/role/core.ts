// File: /swarm/shared/role/core.ts
// Refactored role management module

import {
    type IAgentRuntime,
    logger
} from "@elizaos/core";
import { normalizeUserId } from "../ownership/core";
  
  export enum RoleName {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    NONE = "NONE"
  }
  
  export interface UserRole {
    userId: string;
    serverId: string;
    role: RoleName;
  }
  
  export interface ServerRoleState {
    roles: {
      [userId: string]: UserRole;
    };
  }
  
  // Cache key helpers
  export const ROLE_CACHE_KEYS = {
    SERVER_ROLES: (serverId: string) => `server_${serverId}_user_roles`,
  } as const;
  
  /**
   * Gets or creates role state for a server
   */
  export async function getOrCreateRoleState(
    runtime: IAgentRuntime,
    serverId: string
  ): Promise<ServerRoleState> {
    try {
      const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
      let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
      
      if (!roleState) {
        roleState = { roles: {} };
        await runtime.cacheManager.set(cacheKey, roleState);
        logger.info(`Created new role state for server ${serverId}`);
      } else if (!roleState.roles) {
        roleState.roles = {};
        await runtime.cacheManager.set(cacheKey, roleState);
        logger.info(`Initialized empty roles object for server ${serverId}`);
      }
      
      return roleState;
    } catch (error) {
      logger.error(`Error getting/creating role state for server ${serverId}: ${error}`);
      throw new Error(`Failed to initialize role state: ${error.message}`);
    }
  }
  
  /**
   * Updates role state atomically
   */
  export async function updateRoleState(
    runtime: IAgentRuntime,
    serverId: string,
    updateFn: (currentState: ServerRoleState) => ServerRoleState
  ): Promise<ServerRoleState> {
    try {
      const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
      const currentState = await getOrCreateRoleState(runtime, serverId);
      const newState = updateFn(currentState);
      
      await runtime.cacheManager.set(cacheKey, newState);
      return newState;
    } catch (error) {
      logger.error(`Error updating role state for server ${serverId}: ${error}`);
      throw new Error(`Failed to update role state: ${error.message}`);
    }
  }
  
  /**
   * Initializes role state for a server using normalized IDs
   */
  export async function initializeRoleState(
    runtime: IAgentRuntime,
    serverId: string,
    ownerId: string
  ): Promise<void> {
    try {
      const normalizedOwnerId = normalizeUserId(ownerId);
      
      await updateRoleState(runtime, serverId, (roleState) => {
        roleState.roles[normalizedOwnerId] = {
          userId: normalizedOwnerId,
          serverId,
          role: RoleName.OWNER
        };
        
        return roleState;
      });
      
      logger.info(`Initialized role state for server ${serverId} with owner ${normalizedOwnerId}`);
    } catch (error) {
      logger.error(`Failed to initialize role state for server ${serverId}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Gets a user's role for a server using normalized IDs
   */
  export async function getUserServerRole(
    runtime: IAgentRuntime,
    userId: string,
    serverId: string
  ): Promise<RoleName> {
    try {
      const normalizedUserId = normalizeUserId(userId);
      const roleState = await getOrCreateRoleState(runtime, serverId);
      
      const userRole = roleState.roles[normalizedUserId]?.role;
      if (userRole) {
        logger.info(`Found role for user ${normalizedUserId}: ${userRole}`);
        return userRole;
      }
      
      logger.info(`No role found for user ${normalizedUserId}, defaulting to NONE`);
      return RoleName.NONE;
    } catch (error) {
      logger.error(`Error getting user role: ${error}`);
      return RoleName.NONE;
    }
  }
  
  /**
   * Validates if a user can modify another user's role
   */
  export function canModifyRole(
    modifierRole: RoleName,
    targetRole: RoleName,
    newRole: RoleName
  ): boolean {
    if (modifierRole === RoleName.OWNER) {
      return targetRole !== RoleName.OWNER; // Owners can modify any role except other owners
    }
    
    if (modifierRole === RoleName.ADMIN) {
      // Admins can only modify NONE roles and can't promote to OWNER or ADMIN
      return (
        targetRole === RoleName.NONE &&
        ![RoleName.OWNER, RoleName.ADMIN].includes(newRole)
      );
    }
    
    return false; // Other roles can't modify roles
  }