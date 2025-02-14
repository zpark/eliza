import { IAgentRuntime, logger, UUID } from "@elizaos/core";

export enum RoleName {
    ADMIN = "ADMIN",
    BOSS = "BOSS",
    COLLEAGUE = "COLLEAGUE",
    NONE = "NONE",
    IGNORE = "IGNORE"
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

export interface UserRole {
    userId: string;
    platformId: string; // Discord ID, Telegram ID, etc
    serverId: string;
    role: RoleName;
    assignedBy: string;
    assignedAt: number;
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
                assignedBy: userRole.assignedBy
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