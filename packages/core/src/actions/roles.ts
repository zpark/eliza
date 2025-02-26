import { generateObjectArray } from "..";
import { composeContext } from "../context";
import { logger } from "../logger";
import { Action, ActionExample, ChannelType, HandlerCallback, IAgentRuntime, Memory, ModelClass, RoleName, State } from "../types";
import { stringToUuid } from "../uuid";

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

const updateRoleAction: Action = {
  name: "UPDATE_ROLE",
  similes: ["CHANGE_ROLE", "SET_ROLE", "MODIFY_ROLE"],
  description:
    "Updates the role for a user with respect to the agent, world being the server they are in. For example, if an admin tells the agent that a user is their boss, set their role to ADMIN.",

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
      // Get world data instead of ownership state from cache
      const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
      const world = await runtime.getWorld(worldId);

      // Get requester ID and convert to UUID for consistent lookup
      const requesterId = message.userId;
      const requesterUuid = stringToUuid(requesterId);
      logger.info(`Requester UUID: ${requesterUuid}`);

      // Get roles from world metadata
      if (!world.metadata?.roles) {
        logger.info(`No roles found for server ${serverId}`);
        return false;
      }

      // Lookup using UUID for consistency
      const requesterRole = world.metadata.roles[requesterUuid]
        ?.role as RoleName;
      logger.info(`Requester ${requesterUuid} role:`, requesterRole);

      if (!requesterRole) {
        logger.info("Validation failed: No requester role found");
        return false;
      }

      if (![RoleName.OWNER, RoleName.ADMIN].includes(requesterRole)) {
        logger.info(
          `Validation failed: Role ${requesterRole} insufficient for role management`
        );
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

    // Get world data instead of role cache
    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    let world = await runtime.getWorld(worldId);

    if (!world || !world.metadata) {
      logger.error(`No world or metadata found for server ${serverId}`);
      await callback({
        text: "Unable to process role changes due to missing server data.",
        action: "UPDATE_ROLE",
        source: "discord",
      });
      return;
    }

    // Ensure roles object exists
    if (!world.metadata.roles) {
      world.metadata.roles = {};
    }

    // Get requester's role from world metadata
    const requesterRole =
      (world.metadata.roles[requesterId]?.role as RoleName) || RoleName.NONE;

    const discordClient = runtime.getClient("discord").client;
    const guild = await discordClient.guilds.fetch(serverId);

    // Build server members context
    const members = await guild.members.fetch();
    const serverMembersContext = Array.from(members.values())
      .map((member: any) => `${member.username} (${member.id})`)
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
        action: "UPDATE_ROLE",
        source: "discord",
      });
      return;
    }

    // Process each role assignment
    let worldUpdated = false;

    for (const assignment of result) {
      const targetUser = members.get(assignment.userId);
      if (!targetUser) continue;

      const currentRole = world.metadata.roles[assignment.userId]?.role;

      // Validate role modification permissions
      if (!canModifyRole(requesterRole, currentRole, assignment.newRole)) {
        await callback({
          text: `You don't have permission to change ${targetUser.user.username}'s role to ${assignment.newRole}.`,
          action: "UPDATE_ROLE",
          source: "discord",
        });
        continue;
      }

      // Update role in world metadata
      world.metadata.roles[assignment.userId] = {
        userId: assignment.userId,
        serverId,
        role: assignment.newRole,
      };

      worldUpdated = true;

      await callback({
        text: `Updated ${targetUser.user.username}'s role to ${assignment.newRole}.`,
        action: "UPDATE_ROLE",
        source: "discord",
      });
    }

    // Save updated world metadata if any changes were made
    if (worldUpdated) {
      await runtime.updateWorld(world);
      logger.info(`Updated roles in world metadata for server ${serverId}`);
    }
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
          action: "UPDATE_ROLE",
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
          action: "UPDATE_ROLE",
        },
      },
    ],
  ] as ActionExample[][],
};

export default updateRoleAction;
