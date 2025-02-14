// If the agent is allowed to time out people who are not part of the team, do so
// If someone is being really annoying, aggressive, or offensive, time them out

import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from "@elizaos/core";
import { type Message } from "discord.js";
import { ServerRoleState } from "../../shared/role/types";

interface TimeoutSettings {
    enabled: boolean;
    duration: number; // timeout duration in minutes
    lastUpdated: number;
}

export const timeoutAction: Action = {
    name: "TIMEOUT_USER",
    similes: ["MUTE_USER", "SILENCE_USER", "RESTRICT_USER"],
    description: "Temporarily restricts a user's ability to send messages",
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        if (message.content.source !== "discord") {
            return false;
        }

        if(!state?.discordMessage) {
            throw new Error("No discord message found");
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return false;
        }

        const serverId = discordMessage.guild.id;
        if (!serverId) {
            return false;
        }

        try {
            // Check if timeout functionality is enabled
            const settings = await runtime.cacheManager.get<TimeoutSettings>(
                `server_${serverId}_timeout_permissions`
            );

            if (!settings?.enabled) {
                return false;
            }

            // Get user roles
            const roles = await runtime.cacheManager.get<ServerRoleState>(
                `server_${serverId}_user_roles`
            );

            // Get requester's role
            const requesterId = discordMessage?.author?.id;
            const requesterRole = roles?.roles[requesterId]?.role;

            // Only OWNER and ADMIN roles can timeout
            if (!requesterRole || !["OWNER", "ADMIN"].includes(requesterRole)) {
                return false;
            }

            // Check if message is requesting a timeout
            const timeoutKeywords = [
                "timeout",
                "mute",
                "silence",
                "restrict",
                "quiet",
            ];

            return timeoutKeywords.some(keyword =>
                message.content.text.toLowerCase().includes(keyword)
            );

        } catch (error) {
            logger.error("Error validating timeout action:", error);
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

        if(!state?.discordMessage) {
            throw new Error("No discord message found");
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return;
        }

        const serverId = discordMessage?.guild?.id;
        if (!serverId) {
            logger.error("No server ID found in timeout handler");
            return;
        }

        try {
            // Get timeout settings
            const settings = await runtime.cacheManager.get<TimeoutSettings>(
                `server_${serverId}_timeout_permissions`
            );

            if (!settings?.enabled) {
                logger.error("Timeout functionality not enabled");
                return;
            }

            // Get mentioned user
            const mentionedUser = discordMessage?.mentions?.users?.first();
            if (!mentionedUser) {
                await callback({
                    text: "Please mention the user you want to timeout.",
                    action: "TIMEOUT_USER",
                    source: "discord",
                });
                return;
            }

            // Get roles to check if we can timeout this user
            const roles = await runtime.cacheManager.get<ServerRoleState>(
                `server_${serverId}_user_roles`
            );

            const targetRole = roles?.roles[mentionedUser.id]?.role;

            // Can't timeout OWNER or ADMIN roles
            if (targetRole && ["OWNER", "ADMIN"].includes(targetRole)) {
                await callback({
                    text: "Cannot timeout administrators or managers.",
                    action: "TIMEOUT_USER",
                    source: "discord",
                });
                return;
            }

            // Apply timeout using Discord client
            if (discordMessage?.guild?.members?.cache) {
                const member = await discordMessage.guild.members.fetch(mentionedUser.id);
                if (member) {
                    await member.timeout(settings.duration * 60 * 1000, "Automated timeout by community manager");
                }
            }

            // Create timeout notification
            const content: Content = {
                text: `User ${mentionedUser.username} has been timed out for ${settings.duration} minutes.`,
                action: "TIMEOUT_USER",
                source: "discord",
            };

            // Create memory of timeout
            await runtime.messageManager.createMemory({
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: message.roomId,
                content,
                createdAt: Date.now(),
            });

            // Send notification
            await callback(content);

            // Log timeout
            await runtime.databaseAdapter.log({
                body: { 
                    action: "timeout",
                    targetUser: mentionedUser.id,
                    duration: settings.duration,
                    reason: message.content.text
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                type: "moderation",
            });

        } catch (error) {
            logger.error("Error in timeout handler:", error);
            await callback({
                text: "There was an error applying the timeout.",
                action: "TIMEOUT_USER",
                source: "discord",
            });
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please timeout {{user2}} for spamming",
                    source: "discord",
                },
            },
            {
                user: "{{user3}}",
                content: {
                    text: "User {{user2}} has been timed out for 10 minutes.",
                    action: "TIMEOUT_USER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can we mute {{user2}}? They're being disruptive",
                    source: "discord",
                },
            },
            {
                user: "{{user3}}",
                content: {
                    text: "User {{user2}} has been timed out for 10 minutes.",
                    action: "TIMEOUT_USER",
                },
            },
        ],
    ] as ActionExample[][],
};

export default timeoutAction;