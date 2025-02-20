import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  ChannelType,
  composeContext,
  generateObjectArray,
  logger,
  ModelClass,
  stringToUuid
} from "@elizaos/core";
import type { User } from "discord.js";
import { initializeRoleState } from "../onboarding/initialize";
import { OWNERSHIP_CACHE_KEY } from "../onboarding/types";
import type { ServerRoleState } from "./types";
import { ROLE_CACHE_KEYS, RoleName } from "./types";

// Role modification validation helper
const canModifyRole = (
  currentRole: RoleName,
  targetRole: RoleName | null,
  newRole: RoleName
): boolean => {
  // Owners can modify any role except other owners
  if (currentRole === RoleName.OWNER) {
    return targetRole !== RoleName.OWNER;
  }

  // Admins can only modify NONE roles and can't promote to OWNER or ADMIN
  if (currentRole === RoleName.ADMIN) {
    return (
      (!targetRole || targetRole === RoleName.NONE) &&
      ![RoleName.OWNER, RoleName.ADMIN].includes(newRole)
    );
  }

  return false;
};

const extractionTemplate = `# Task: Extract role assignments from the conversation

# Current Server Members:
{{serverMembers}}

# Available Roles:
- OWNER: Full control over the organization
- ADMIN: Administrative privileges
- NONE: Standard member access

# Recent Conversation:
{{recentMessages}}

# Current speaker role: {{speakerRole}}

# Instructions: Analyze the conversation and extract any role assignments being made by the speaker.
Only extract role assignments if:
1. The speaker has appropriate permissions to make the change
2. The role assignment is clearly stated
3. The target user is a valid server member
4. The new role is one of: OWNER, ADMIN, or NONE

Return the results in this JSON format:
{
"roleAssignments": [
  {
    "userId": "discord_id",
    "newRole": "ROLE_NAME"
  }
]
}

If no valid role assignments are found, return an empty array.
`;

interface RoleAssignment {
  userId: string;
  newRole: RoleName;
}

const updateOrgRoleAction: Action = {
  name: "SET_ORG_RELATIONSHIP",
  similes: ["CHANGE_ROLE", "SET_ROLE", "MODIFY_ROLE"],
  description:
    "Updates organizational roles based on commands from authorized users.",

    validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      _state: State
    ): Promise<boolean> => {
      logger.info("Starting role update validation");
    
      // Validate message source
      if (message.content.source !== "discord") {
        logger.info("Validation failed: Not a discord message");
        return false;
      }
    
      const room = await runtime.getRoom(message.roomId);
      if (!room) {
        throw new Error("No room found");
      }
    
      // if room type is DM, return
      if (room.type !== ChannelType.GROUP) {
        // only handle in a group scenario for now
        return false;
      }
    
      const serverId = room.serverId;
      if (!serverId) {
        throw new Error("No server ID found");
      }
    
      try {
        // First check if ownership state exists
        const ownershipState = await runtime.cacheManager.get<{ servers: { [key: string]: { ownerId: string } } }>(
          OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE
        );
    
        if (!ownershipState?.servers) {
          logger.error(`No ownership state found for server ${serverId}`);
          
          // Try to recover by initializing from Discord if possible
          const discordClient = runtime.getClient("discord").client;
          try {
            const guild = await discordClient.guilds.fetch(serverId);
            if (guild?.ownerId) {
              // Create temporary ownership state
              await runtime.cacheManager.set(
                OWNERSHIP_CACHE_KEY.SERVER_OWNERSHIP_STATE,
                { servers: { [serverId]: { ownerId: guild.ownerId } } }
              );
              
              // Also initialize role state
              await initializeRoleState(runtime, serverId, guild.ownerId);
              logger.info(`Recovered ownership and role state for server ${serverId}`);
            } else {
              return false;
            }
          } catch (error) {
            logger.error(`Failed to recover: ${error}`);
            return false;
          }
        }
    
        // Get requester ID and convert to UUID for consistent lookup
        const requesterId = message.userId;
        const requesterUuid = stringToUuid(requesterId);
        logger.info(`Requester UUID: ${requesterUuid}`);
    
        const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
        logger.info(`Checking role cache with key: ${cacheKey}`);
    
        const roleCache = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
    
        if (!roleCache?.roles) {
          logger.info(`No role cache found for server ${serverId}`);
          return false;
        }
    
        // Lookup using UUID for consistency
        const requesterRole = roleCache.roles[requesterUuid]?.role as RoleName;
        logger.info(`Requester ${requesterUuid} role:`, requesterRole);
    
        if (!requesterRole) {
          logger.info("Validation failed: No requester role found");
          return false;
        }
    
        if (![RoleName.OWNER, RoleName.ADMIN].includes(requesterRole)) {
          logger.info(`Validation failed: Role ${requesterRole} insufficient for role management`);
          return false;
        }
    
        return true;
      } catch (error) {
        logger.error("Error validating updateOrgRole action:", error);
        return false;
      }
    },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    responses: Memory[]
  ): Promise<void> => {
    // Handle initial responses
    for (const response of responses) {
      await callback(response.content);
    }

    const room = await runtime.getRoom(message.roomId);

    if (!room) {
      throw new Error("No room found");
    }

    const serverId = room.serverId;

    const requesterId = message.userId;
    const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
    // Get roles cache
    let roleCache = await runtime.cacheManager.get<ServerRoleState>(
      cacheKey
    );

    if (!roleCache) {
      roleCache = {
        roles: {},
      };
    }

    // Get requester's role
    const requesterRole = roleCache.roles[requesterId]?.role as RoleName;

    const discordClient = runtime.getClient("discord").client;
    const guild = await discordClient.guilds.fetch(serverId);

    // Build server members context
    const members = await guild.members.fetch();
    const serverMembersContext = Array.from(members.values())
      .map((member: User) => `${member.username} (${member.id})`)
      .join("\n");

    // Create extraction context
    const extractionContext = composeContext({
      state: {
        ...state,
        serverMembers: serverMembersContext,
        speakerRole: requesterRole,
      },
      template: extractionTemplate,
    });

    // Extract role assignments
    const result = (await generateObjectArray({
      runtime,
      context: extractionContext,
      modelClass: ModelClass.SMALL,
    })) as RoleAssignment[];

    if (!result?.length) {
      console.log("No valid role assignments found in the request.");
      await callback({
        text: "No valid role assignments found in the request.",
        action: "SET_ORG_RELATIONSHIP",
        source: "discord",
      });
      return;
    }

    // Process each role assignment
    for (const assignment of result) {
      const targetUser = members.get(assignment.userId);
      if (!targetUser) continue;

      const currentRole = roleCache.roles[assignment.userId]?.role;

      // Validate role modification permissions
      if (!canModifyRole(requesterRole, currentRole, assignment.newRole)) {
        await callback({
          text: `You don't have permission to change ${targetUser.user.username}'s role to ${assignment.newRole}.`,
          action: "SET_ORG_RELATIONSHIP",
          source: "discord",
        });
        continue;
      }

      // Update role
      roleCache.roles[assignment.userId] = {
        userId: assignment.userId,
        serverId,
        role: assignment.newRole,
      };

      await callback({
        text: `Updated ${targetUser.user.username}'s role to ${assignment.newRole}.`,
        action: "SET_ORG_RELATIONSHIP",
        source: "discord",
      });
    }

    await runtime.cacheManager.set(cacheKey, roleCache);
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Make {{user2}} an ADMIN",
          source: "discord",
        },
      },
      {
        user: "{{user3}}",
        content: {
          text: "Updated {{user2}}'s role to ADMIN.",
          action: "SET_ORG_RELATIONSHIP",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Set @alice and @bob as admins",
          source: "discord",
        },
      },
      {
        user: "{{user3}}",
        content: {
          text: "Updated alice's role to ADMIN.\nUpdated bob's role to ADMIN.",
          action: "SET_ORG_RELATIONSHIP",
        },
      },
    ],
  ] as ActionExample[][],
};

export default updateOrgRoleAction;
