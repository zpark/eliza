import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger
} from "@elizaos/core";
import { type Message, ChannelType } from "discord.js";
import { RoleName, getUserServerRole } from "../role/types";
import { type OnboardingSetting, type OnboardingState } from "./types";

interface SettingCacheItem<T> {
    value: T;
    enabled?: boolean;
    lastUpdated: number;
}

const onboardingAction: Action = {
    name: "SAVE_SETTING",
    similes: ["UPDATE_SETTING", "SET_CONFIGURATION", "CONFIGURE"],
    description: "Saves a setting during the onboarding process",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        if(!state?.discordMessage) {
            return false;
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id || discordMessage?.channel.type !== ChannelType.DM) {
            return false;
        }

        const serverId = discordMessage.guild.id;
        const userId = discordMessage.author.id;

        try {
            // Check if user has admin role
            const userRole = await getUserServerRole(runtime, userId, serverId);
            if (userRole !== RoleName.ADMIN) {
                return false;
            }

            // Get current onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            if (!onboardingState || onboardingState.completed) {
                return false;
            }

            // Check if message looks like a setting configuration
            const settingKeywords = [
                "set",
                "enable",
                "disable",
                "configure",
                "yes",
                "no",
                "true",
                "false"
            ];

            return settingKeywords.some(keyword => 
                message.content.text.toLowerCase().includes(keyword)
            );

        } catch (error) {
            logger.error("Error validating onboarding action:", error);
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
        if(!state?.discordMessage) {
            return;
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return;
        }

        const serverId = discordMessage.guild.id;
        const userId = discordMessage.author.id;

        try {
            // Verify admin role again in handler
            const userRole = await getUserServerRole(runtime, userId, serverId);
            if (userRole !== RoleName.ADMIN) {
                await callback({
                    text: "You need admin permissions to configure settings.",
                    action: "SAVE_SETTING",
                    source: "discord"
                });
                return;
            }

            // Get current onboarding state
            let onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            if (!onboardingState) {
                await callback({
                    text: "Onboarding hasn't been initialized yet.",
                    action: "SAVE_SETTING",
                    source: "discord"
                });
                return;
            }

            // Find the next unconfigured setting
            const nextSetting = Object.entries(onboardingState.settings)
                .find(([_, setting]) => {
                    if (setting.value === null) {
                        const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                            onboardingState.settings[dep]?.value !== null
                        );
                        return dependenciesMet;
                    }
                    return false;
                });

            if (!nextSetting) {
                onboardingState.completed = true;
                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState,
                );

                await callback({
                    text: "Onboarding complete! All settings have been configured.",
                    action: "SAVE_SETTING",
                    source: "discord"
                });
                return;
            }

            const [settingKey, setting] = nextSetting as [string, OnboardingSetting];
            const messageText = message.content.text.toLowerCase();

            // Parse value based on the message
            let value: string | boolean | null = null;

            // Handle boolean settings
            if (messageText.includes("yes") || messageText.includes("true") || messageText.includes("enable")) {
                value = true;
            } else if (messageText.includes("no") || messageText.includes("false") || messageText.includes("disable")) {
                value = false;
            } else {
                // Extract potential channel mentions or other values
                if (messageText.includes("<#")) {
                    const channelMatch = messageText.match(/<#(\d+)>/);
                    value = channelMatch ? channelMatch[1] : null;
                    
                    // Verify channel exists
                    if (value) {
                        const channel = discordMessage.guild.channels.cache.get(value);
                        if (!channel) {
                            await callback({
                                text: "That channel doesn't exist in this server.",
                                action: "SAVE_SETTING",
                                source: "discord"
                            });
                            return;
                        }
                    }
                } else {
                    // Use the whole message as value, removing common prefixes
                    value = messageText
                        .replace(/^(set|configure|make it|use|let's use)\s+/i, '')
                        .trim();
                }
            }

            // Validate the value
            if (setting.validation && value !== null) {
                try {
                    if (!setting.validation(value)) {
                        await callback({
                            text: `Invalid value for ${setting.name}. ${setting.description}`,
                            action: "SAVE_SETTING",
                            source: "discord"
                        });
                        return;
                    }
                } catch (error) {
                    logger.error("Error in setting validation:", error);
                    await callback({
                        text: "There was an error validating your input.",
                        action: "SAVE_SETTING",
                        source: "discord"
                    });
                    return;
                }
            }

            // Update the setting
            onboardingState.settings[settingKey].value = value;
            onboardingState.lastUpdated = Date.now();

            // Save updated state
            await runtime.cacheManager.set(
                `server_${serverId}_onboarding_state`,
                onboardingState
            );

            // Apply the setting to the appropriate cache location
            await applySettingToCache(runtime, serverId, settingKey, value);

            // Find next unconfigured setting
            const nextUnconfiguredSetting = Object.entries(onboardingState.settings as { [key: string]: OnboardingSetting })
                .find(([_, s]) => s.value === null && (!s.dependsOn || s.dependsOn.every(dep => 
                    onboardingState.settings[dep]?.value !== null
                )));

            let responseText = `✓ Saved ${setting.name}: ${value}\n\n`;

            if (nextUnconfiguredSetting) {
                const [_, nextSetting] = nextUnconfiguredSetting;
                responseText += `Next setting: ${nextSetting.name}\n${nextSetting.description}`;
            } else {
                responseText += "All settings configured! Onboarding complete.";
                onboardingState.completed = true;
                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState,
                );
            }

            await callback({
                text: responseText,
                action: "SAVE_SETTING",
                source: "discord"
            });

            // Log setting update
            await runtime.databaseAdapter.log({
                body: {
                    type: "setting_update",
                    setting: settingKey,
                    value: value,
                    serverId: serverId,
                    updatedBy: userId
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                type: "onboarding"
            });

        } catch (error) {
            logger.error("Error in onboarding handler:", error);
            await callback({
                text: "There was an error saving your setting.",
                action: "SAVE_SETTING",
                source: "discord"
            });
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Yes, enable greeting new users",
                    source: "discord"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "✓ Saved Greet New Users: true\n\nNext setting: Greeting Channel\nWhich channel should I use for greeting new users?",
                    action: "SAVE_SETTING"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Use #welcome for greetings",
                    source: "discord"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "✓ Saved Greeting Channel: #welcome\n\nNext setting: Allow Timeouts\nShould I be allowed to timeout users who violate community guidelines?",
                    action: "SAVE_SETTING"
                }
            }
        ]
    ] as ActionExample[][]
};

async function applySettingToCache(
    runtime: IAgentRuntime,
    serverId: string,
    settingKey: string,
    value: any
): Promise<void> {
    try {
        switch (settingKey) {
            case "SHOULD_GREET_NEW_USERS":
                await runtime.cacheManager.set<SettingCacheItem<boolean>>(
                    `server_${serverId}_settings_greet`,
                    { 
                        value,
                        enabled: value,
                        lastUpdated: Date.now() 
                    },
                );
                break;

            case "ALLOW_TIMEOUTS":
                await runtime.cacheManager.set<SettingCacheItem<boolean>>(
                    `server_${serverId}_timeout_permissions`,
                    { 
                        value,
                        enabled: value,
                        lastUpdated: Date.now()
                    }
                );
                break;

            case "TIMEOUT_DURATION": {
                const timeoutSettings = await runtime.cacheManager.get<SettingCacheItem<number>>(
                    `server_${serverId}_timeout_permissions`
                ) || { 
                    value: 10,
                    enabled: false,
                    lastUpdated: Date.now()
                };

                timeoutSettings.value = value;
                timeoutSettings.lastUpdated = Date.now();

                await runtime.cacheManager.set(
                    `server_${serverId}_timeout_permissions`,
                    timeoutSettings
                );
                break;
            }

            default:
                // For settings that don't need separate cache entries, 
                // they're already stored in the onboarding state
                break;
        }
    } catch (error) {
        logger.error("Error applying setting to cache:", error);
        throw error;
    }
}

export default onboardingAction;