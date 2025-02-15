// Send the user a DM (if in a guild channel)

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
} from "@elizaos/core";
import type { Message } from "discord.js";

const dmAction: Action = {
    name: "DM",
    similes: ["DIRECT_MESSAGE", "PRIVATE_MESSAGE", "PM", "WHISPER"],
    description: "Sends a direct message to a user",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return false;
        }

        // Check if this is a request to DM someone
        const dmKeywords = [
            "dm",
            "pm",
            "private message",
            "direct message",
            "whisper",
            "message privately",
            "send private"
        ];

        return dmKeywords.some(keyword => 
            message.content.text.toLowerCase().includes(keyword)
        );
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<void> => {
        const discordMessage = state.discordMessage as Message;
        
        try {
            // Get mentioned user
            const mentionedUser = discordMessage?.mentions?.users?.first();
            if (!mentionedUser) {
                await callback({
                    text: "Please mention the user you want me to DM.",
                    action: "DM",
                    source: "discord"
                });
                return;
            }

            // Try to create DM channel
            const dmChannel = await mentionedUser.createDM();
            if (!dmChannel) {
                await callback({
                    text: "I couldn't create a DM channel with that user.",
                    action: "DM",
                    source: "discord"
                });
                return;
            }

            // Process initial responses if any
            for (const response of responses) {
                const content = response.content.text;
                
                try {
                    // Send message to DM channel
                    await dmChannel.send(content);

                    // Create memory of the DM
                    await runtime.messageManager.createMemory({
                        userId: runtime.agentId,
                        agentId: runtime.agentId,
                        roomId: stringToUuid(dmChannel.id),
                        content: {
                            text: content,
                            action: "DM",
                            source: "discord"
                        },
                        createdAt: Date.now()
                    });

                    // Send confirmation in original channel
                    await callback({
                        text: `I've sent a DM to ${mentionedUser.username}.`,
                        action: "DM",
                        source: "discord"
                    });

                    // Log the DM
                    await runtime.databaseAdapter.log({
                        body: {
                            type: "dm_sent",
                            targetUser: mentionedUser.id,
                            messageLength: content.length
                        },
                        userId: runtime.agentId,
                        roomId: message.roomId,
                        type: "direct_message"
                    });

                } catch (error) {
                    logger.error("Error sending DM:", error);
                    await callback({
                        text: "I couldn't send the DM. The user might have DMs disabled.",
                        action: "DM",
                        source: "discord"
                    });
                }
            }

        } catch (error) {
            logger.error("Error in DM handler:", error);
            await callback({
                text: "There was an error processing the DM request.",
                action: "DM",
                source: "discord"
            });
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you DM {{user2}} about the updates?",
                    source: "discord"
                }
            },
            {
                user: "{{user3}}",
                content: {
                    text: "Sure, I'll send them a message about that.",
                    action: "DM"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send a private message to {{user2}} about their behavior",
                    source: "discord"
                }
            },
            {
                user: "{{user3}}",
                content: {
                    text: "I'll DM them right away.",
                    action: "DM"
                }
            }
        ]
    ] as ActionExample[][]
};

export default dmAction;