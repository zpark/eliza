import { IAgentRuntime, logger, UUID } from "@elizaos/core";

export enum RoleName {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MEMBER = "MEMBER",
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

        console.log("*** runtime.cacheManager roleState", roleState);
        
        return roleState?.roles[userId]?.role || RoleName.NONE;
    } catch (error) {
        logger.error("Error getting user role:", error);
        return RoleName.NONE;
    }
}