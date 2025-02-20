import { type IAgentRuntime, logger, stringToUuid, UUID } from "@elizaos/core";

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

// Role validation helpers
export function canModifyRole(modifierRole: RoleName, targetRole: RoleName, newRole: RoleName): boolean {
    if (modifierRole === RoleName.OWNER) {
        return true; // Admins can modify any role
    }
    
    if (modifierRole === RoleName.ADMIN) {
        // Bosses can only modify MEMBER, NONE, and IGNORE roles
        return ![RoleName.OWNER, RoleName.ADMIN].includes(targetRole) &&
               ![RoleName.OWNER, RoleName.ADMIN].includes(newRole);
    }
    
    return false; // Other roles can't modify roles
}

export async function getUserServerRole(
  runtime: IAgentRuntime,
  userId: string,
  serverId: string
): Promise<RoleName> {
  try {
    const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
    logger.info(`Looking up roles with cache key: ${cacheKey}`);

    const roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
    
    if (!roleState?.roles) {
      logger.info(`No roles found for server ${serverId}`);
      return RoleName.NONE;
    }

    // Always convert userId to UUID for consistent lookup
    const userUuid = stringToUuid(userId);
    logger.info(`Looking up role for UUID ${userUuid}`);
    
    if (roleState.roles[userUuid]?.role) {
      const role = roleState.roles[userUuid].role;
      logger.info(`Found role for user ${userId}: ${role}`);
      return role;
    }
    
    logger.info(`No role found for user ${userId} (UUID: ${userUuid})`);
    return RoleName.NONE;
  } catch (error) {
    logger.error("Error getting user role:", error);
    return RoleName.NONE;
  }
}