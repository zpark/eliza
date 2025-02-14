// Provide the current social awareness state
// Load this from cache and convert the anxiety score to a string
// Consult a table of anxiety scores to strings, each score range should have a list of strings which are randomly chosen and returned
// Anxiety should map to a work oriented setting, where the agent should listen to the ADMIN and increasingly ignore colleagues

import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { type Message } from "discord.js";

interface AnxietyScore {
    score: number;
    lastMessageTimestamp: number;
    recentMessageCount: number;
    lastDecayTimestamp: number;
}

interface ServerRoleState {
    roles: {
        [userId: string]: {
            role: string;
        };
    };
    lastUpdated: number;
}

const DECAY_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_ANXIETY = 10;
const ANXIETY_THRESHOLD = 7;

const socialAwarenessProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if(!state?.discordMessage) {
            throw new Error("No discord message found");
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return "";
        }

        const serverId = discordMessage.guild.id;
        const now = Date.now();

        try {
            // Get current anxiety score
            let anxietyData = await runtime.cacheManager.get<AnxietyScore>(
                `server_${serverId}_anxiety_score`
            );

            if (!anxietyData) {
                anxietyData = {
                    score: 0,
                    lastMessageTimestamp: now,
                    recentMessageCount: 0,
                    lastDecayTimestamp: now,
                };
            }

            // Check roles for message sender
            const roles = await runtime.cacheManager.get<ServerRoleState>(
                `server_${serverId}_user_roles`
            );

            const senderId = discordMessage.author?.id;
            const senderRole = senderId ? roles?.roles[senderId]?.role : null;

            // Calculate decay
            const timeSinceLastDecay = now - anxietyData.lastDecayTimestamp;
            const decayPeriods = Math.floor(timeSinceLastDecay / DECAY_INTERVAL);
            
            if (decayPeriods > 0) {
                // Decay anxiety by half for each period
                anxietyData.score = anxietyData.score * Math.pow(0.5, decayPeriods);
                anxietyData.lastDecayTimestamp = now;
            }

            // Update anxiety based on message context
            if (senderRole) {
                switch (senderRole) {
                    case "OWNER":
                    case "ADMIN":
                        // Reset anxiety if directly addressed by admin/boss
                        if (message.content.text.toLowerCase().includes(runtime.character.name.toLowerCase())) {
                            anxietyData.score = 0;
                        }
                        break;

                    case "USER":
                        // Increase anxiety if engaging unnecessarily with colleagues
                        if (anxietyData.recentMessageCount > 3) {
                            anxietyData.score = Math.min(anxietyData.score + 2, MAX_ANXIETY);
                        }
                        break;

                    case "NONE":
                        // Moderate anxiety increase for regular users
                        anxietyData.score = Math.min(anxietyData.score + 1, MAX_ANXIETY);
                        break;
                }
            }

            // Update message count and timestamp
            anxietyData.recentMessageCount++;
            anxietyData.lastMessageTimestamp = now;

            // Store updated anxiety score
            await runtime.cacheManager.set(
                `server_${serverId}_anxiety_score`,
                anxietyData
            );

            // Generate awareness message based on anxiety level
            let awarenessMessage = "";
            if (anxietyData.score > ANXIETY_THRESHOLD) {
                awarenessMessage = `
Warning: High interaction frequency detected (Anxiety Score: ${anxietyData.score.toFixed(1)})
Consider reducing response frequency unless directly addressed.
Last message: ${new Date(anxietyData.lastMessageTimestamp).toISOString()}
Recent message count: ${anxietyData.recentMessageCount}`;
            } else if (anxietyData.score > ANXIETY_THRESHOLD / 2) {
                awarenessMessage = `
Note: Moderate interaction level (Anxiety Score: ${anxietyData.score.toFixed(1)})
Monitor engagement frequency.`;
            }

            return awarenessMessage;

        } catch (error) {
            logger.error("Error in social awareness provider:", error);
            return "";
        }
    },
};

export default socialAwarenessProvider;