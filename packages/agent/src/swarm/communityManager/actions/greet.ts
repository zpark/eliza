// If a user is new to the server, greet them in the general channel
// Only available if the SHOULD_GREET_NEW_USERS setting is true, which should be loaded from the cache from onboarding

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

interface GreetingSettings {
    enabled: boolean;
    channelId?: string;
    message?: string;
    lastUpdated: number;
}

export const greetAction: Action = {
    name: "GREET_NEW_USER",
    similes: ["WELCOME_USER", "SAY_HELLO", "INTRODUCE"],
    description: "Greets new users in the configured channel",
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        // Only validate for Discord messages
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

        // Get server ID from state
        const serverId = discordMessage?.guild?.id;
        if (!serverId) {
            return false;
        }

        try {
            // Check if greeting is enabled for this server
            const settings = await runtime.cacheManager.get<GreetingSettings>(
                `server_${serverId}_settings_greet`
            );

            if (!settings?.enabled) {
                return false;
            }

            // Check if this is a new user join event or command to greet
            const isNewUser = message.content.text.includes("joined the server");
            const isGreetCommand = message.content.text.toLowerCase().includes("greet") ||
                                 message.content.text.toLowerCase().includes("welcome");

            return isNewUser || isGreetCommand;
        } catch (error) {
            logger.error("Error validating greet action:", error);
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
            logger.error("No server ID found in greet handler");
            return;
        }

        try {
            // Get greeting settings
            const settings = await runtime.cacheManager.get<GreetingSettings>(
                `server_${serverId}_settings_greet`
            );

            if (!settings?.enabled || !settings.channelId) {
                logger.error("Greeting settings not properly configured");
                return;
            }

            // Get user info from the message
            const username = discordMessage?.author?.username || "new member";
            const userId = discordMessage?.author?.id;

            // Build greeting message
            const greeting = settings.message || 
                           `Welcome ${username}! I'm ${runtime.character.name}, the community manager. Feel free to introduce yourself!`;

            const content: Content = {
                text: greeting,
                action: "GREET_NEW_USER",
                source: "discord",
            };

            // Create memory of greeting
            await runtime.messageManager.createMemory({
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: message.roomId,
                content,
                createdAt: Date.now(),
            });

            // Send greeting
            await callback(content);

            // Log greeting
            await runtime.databaseAdapter.log({
                body: { greeting, userId },
                userId: runtime.agentId,
                roomId: message.roomId,
                type: "greeting",
            });

        } catch (error) {
            logger.error("Error in greet handler:", error);
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{user2}} joined the server",
                    source: "discord",
                },
            },
            {
                user: "{{user3}}",
                content: {
                    text: "Welcome {{user2}}! I'm the community manager. Feel free to introduce yourself!",
                    action: "GREET_NEW_USER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can someone greet {{user2}}?",
                    source: "discord",
                },
            },
            {
                user: "{{user3}}",
                content: {
                    text: "Hi {{user2}}! Welcome to our community!",
                    action: "GREET_NEW_USER",
                },
            },
        ],
    ] as ActionExample[][],
};

export default greetAction;