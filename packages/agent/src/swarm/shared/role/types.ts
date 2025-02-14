import { IAgentRuntime, logger, UUID } from "@elizaos/core";

export enum RoleName {
    ADMIN = "ADMIN",
    BOSS = "BOSS",
    COLLEAGUE = "COLLEAGUE",
    NONE = "NONE",
    IGNORE = "IGNORE"
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
    lastUpdated: number;
}

// Cache key helpers
export const ROLE_CACHE_KEYS = {
    SERVER_ROLES: (serverId: string) => `server_${serverId}_user_roles`,
} as const;

// Role validation helpers
export function canModifyRole(modifierRole: RoleName, targetRole: RoleName, newRole: RoleName): boolean {
    if (modifierRole === RoleName.ADMIN) {
        return true; // Admins can modify any role
    }
    
    if (modifierRole === RoleName.BOSS) {
        // Bosses can only modify COLLEAGUE, NONE, and IGNORE roles
        return ![RoleName.ADMIN, RoleName.BOSS].includes(targetRole) &&
               ![RoleName.ADMIN, RoleName.BOSS].includes(newRole);
    }
    
    return false; // Other roles can't modify roles
}

// Role access helpers
export async function getUserServerRole(
    runtime: IAgentRuntime,
    userId: string,
    serverId: string
): Promise<RoleName> {
    try {
        const roleState = await runtime.cacheManager.get<ServerRoleState>(
            ROLE_CACHE_KEYS.SERVER_ROLES(serverId)
        );
        
        return roleState?.roles[userId]?.role || RoleName.NONE;
    } catch (error) {
        logger.error("Error getting user role:", error);
        return RoleName.NONE;
    }
}