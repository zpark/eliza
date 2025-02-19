import {
  type Action,
  type ActionExample,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  stringToUuid,
  generateObjectArray,
  composeContext,
  ModelClass
} from "@elizaos/core";
import type { Message } from "discord.js";
import type { ServerRoleState } from "./types";
import { RoleName } from "./types";

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
  description: "Updates organizational roles based on commands from authorized users.",

  validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State
  ): Promise<boolean> => {
      logger.info("Starting role update validation");
      
      // Validate message source
      if (message.content.source !== "discord") {
          logger.info("Validation failed: Not a discord message");
          return false;
      }

      // Validate discord message exists
      if (!state?.discordMessage) {
          logger.info("Validation failed: No discord message in state");
          return false;
      }
      const discordMessage = state.discordMessage as Message;

      try {
          const serverId = discordMessage.guild?.id;
          if (!serverId) {
              logger.info("Validation failed: No guild ID");
              return false;
          }

          const requesterId = discordMessage.author.id;
          
          const cacheKey = `server_${serverId}_user_roles`;
          logger.info(`Checking role cache with key: ${cacheKey} for user ${requesterId}`);

          const roleCache = await runtime.cacheManager.get<ServerRoleState>(cacheKey);

          if (!roleCache?.roles) {
              logger.info(`No role cache found for server ${serverId}`);
              return false;
          }

          const requesterRole = roleCache.roles[requesterId]?.role;
          logger.info(`Requester ${requesterId} role:`, requesterRole);

          if (!requesterRole) {
              logger.info("Validation failed: No requester role found");
              return false;
          }

          if (![RoleName.OWNER, RoleName.ADMIN].includes(requesterRole as RoleName)) {
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
      options: any,
      callback: HandlerCallback,
      responses: Memory[]
  ): Promise<void> => {
      // Handle initial responses
      for (const response of responses) {
          await callback(response.content);
      }

      if (!state?.discordMessage) {
          throw new Error("No discord message in state");
      }
      const discordMessage = state.discordMessage as Message;

      try {
          const guild = await discordMessage.guild?.fetch();
          if (!guild?.id) {
              throw new Error("Could not fetch guild data");
          }

          const serverId = guild.id;
          const requesterId = discordMessage.author.id;

          // Get roles cache
          let roleCache = await runtime.cacheManager.get<ServerRoleState>(
              `server_${serverId}_user_roles`
          );

          if (!roleCache) {
              roleCache = {
                  roles: {},
                  lastUpdated: Date.now(),
              };
          }

          // Get requester's role
          const requesterRole = roleCache.roles[requesterId]?.role as RoleName;

          // Build server members context
          const members = await guild.members.fetch();
          const serverMembersContext = Array.from(members.values())
              .map(member => `${member.user.username} (${member.user.id})`)
              .join('\n');

          // Create extraction context
          const extractionContext = composeContext({
              state: {
                  ...state,
                  serverMembers: serverMembersContext,
                  speakerRole: requesterRole
              },
              template: extractionTemplate
          });

          // Extract role assignments
          const result = await generateObjectArray({
              runtime,
              context: extractionContext,
              modelClass: ModelClass.SMALL
          }) as RoleAssignment[];

          console.log("result", result);

          if (!result?.length) {
              console.log("No valid role assignments found in the request.");
              await callback({
                  text: "No valid role assignments found in the request.",
                  action: "SET_ORG_RELATIONSHIP",
                  source: "discord"
              });
              return;
          }

          console.log("result.roleAssignments", result);

          // Process each role assignment
          for (const assignment of result) {
              console.log("assignment", assignment);
              const targetUser = members.get(assignment.userId);
              if (!targetUser) continue;

              const currentRole = roleCache.roles[assignment.userId]?.role;

              // Validate role modification permissions
              if (!canModifyRole(requesterRole, currentRole, assignment.newRole)) {
                  await callback({
                      text: `You don't have permission to change ${targetUser.user.username}'s role to ${assignment.newRole}.`,
                      action: "SET_ORG_RELATIONSHIP",
                      source: "discord"
                  });
                  continue;
              }

              // Update role
              roleCache.roles[assignment.userId] = {
                  userId: assignment.userId,
                  serverId,
                  role: assignment.newRole
              };

              await callback({
                  text: `Updated ${targetUser.user.username}'s role to ${assignment.newRole}.`,
                  action: "SET_ORG_RELATIONSHIP",
                  source: "discord"
              });
          }

          // Save updated roles
          roleCache.lastUpdated = Date.now();
          await runtime.cacheManager.set(
              `server_${serverId}_user_roles`,
              roleCache
          );

      } catch (error) {
          logger.error("Error in updateOrgRole handler:", error);
          await callback({
              text: "There was an error updating the role(s).",
              action: "SET_ORG_RELATIONSHIP",
              source: "discord"
          });
      }
  },

  examples: [
      [
          {
              user: "{{user1}}",
              content: {
                  text: "Make {{user2}} an ADMIN",
                  source: "discord"
              }
          },
          {
              user: "{{user3}}",
              content: {
                  text: "Updated {{user2}}'s role to ADMIN.",
                  action: "SET_ORG_RELATIONSHIP"
              }
          }
      ],
      [
          {
              user: "{{user1}}",
              content: {
                  text: "Set @alice and @bob as admins",
                  source: "discord"
              }
          },
          {
              user: "{{user3}}",
              content: {
                  text: "Updated alice's role to ADMIN.\nUpdated bob's role to ADMIN.",
                  action: "SET_ORG_RELATIONSHIP"
              }
          }
      ]
  ] as ActionExample[][]
};

export default updateOrgRoleAction;