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
import { type OnboardingState } from "./types";

const onboardingAction: Action = {
    name: "SAVE_SETTING",
    similes: ["UPDATE_SETTING", "SET_CONFIGURATION", "CONFIGURE"],
    description: "Saves a setting during the onboarding process",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        console.log("*** validating onboarding action");
        if(!state?.discordMessage) {
            console.log("*** no discord message found");
            return false;
        }
        const discordMessage = state.discordMessage as Message;
        
        if (discordMessage.channel.type !== ChannelType.DM) {
            console.log("*** channel type not dm");
            return false;
        }
    
        const userId = discordMessage.author.id;
        const serverId = discordMessage.guildId;

        try {
            // First check if there's an active onboarding session
            const ownershipState = await runtime.cacheManager.get<{ servers: { [key: string]: { ownerId: string } } }>(
                'server_ownership_state'
            );

            if (!ownershipState?.servers) {
                console.log("*** no ownership state found");
                return false;
            }

            // Find the server where this user is the owner
            const serverEntry = Object.entries(ownershipState.servers)
                .find(([_, info]) => info.ownerId === userId);

            if (!serverEntry) {
                console.log("*** user is not owner of any server");
                return false;
            }

            const [targetServerId] = serverEntry;

            // Check if there's an active onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${targetServerId}_onboarding_state`
            );

            if (!onboardingState) {
                console.log("*** no onboarding state found");
                return false;
            }

            // Store these in state for the handler
            state.onboardingServerId = targetServerId;
            state.onboardingState = onboardingState;
            
            console.log("*** found active onboarding for server", targetServerId);
            return true;

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
        callback: HandlerCallback
    ): Promise<void> => {
        if (!state.onboardingServerId || !state.onboardingState) {
            await callback({
                text: "Onboarding session not found or expired.",
                action: "SAVE_SETTING",
                source: "discord"
            });
            return;
        }

        const serverId = state.onboardingServerId;
        const discordMessage = state.discordMessage as Message;
        const userId = discordMessage.author.id;

        try {
            // Get current onboarding state - we already validated it exists
            const onboardingState = state.onboardingState;
            console.log("*** onboardingState", onboardingState);

            // Find the next unconfigured setting
            const nextSetting = Object.entries(onboardingState)
                .find(([_, setting]) => {
                    if (setting.value === null && (!setting.visibleIf || setting.visibleIf(onboardingState))) {
                        const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                            onboardingState[dep]?.value !== null
                        );
                        return dependenciesMet;
                    }
                    return false;
                });

            if (!nextSetting) {
                await callback({
                    text: "All settings have been configured.",
                    action: "SAVE_SETTING",
                    source: "discord"
                });
                return;
            }

            const [settingKey, setting] = nextSetting;

            // Parse value based on the message
            let value: string | boolean | null = message.content.text.trim();

            // Validate the value if needed
            if (setting.validation && !setting.validation(value)) {
                await callback({
                    text: `Invalid value for ${setting.name}. ${setting.description}`,
                    action: "SAVE_SETTING",
                    source: "discord"
                });
                return;
            }

            // Update the setting
            onboardingState[settingKey].value = value;

            // Save updated state
            await runtime.cacheManager.set(
                `server_${serverId}_onboarding_state`,
                onboardingState
            );

            // Find next unconfigured setting
            const nextUnconfiguredSetting = Object.entries(onboardingState)
                .find(([_, s]) => s.value === null && (!s.dependsOn || s.dependsOn.every(dep => 
                    onboardingState[dep]?.value !== null
                )));

            console.log("*** nextUnconfiguredSetting", nextUnconfiguredSetting);
            console.log("*** onboardingState", onboardingState);
            console.log("*** settingKey", settingKey);
            console.log("*** setting", setting);
            console.log("*** value", value);

            let responseText = `✓ Saved ${setting.name}: ${value}\n\n`;

            if (nextUnconfiguredSetting) {
                const [_, nextSetting] = nextUnconfiguredSetting;
                responseText += `Next setting: ${nextSetting.name}\n${nextSetting.description}`;
            } else {
                responseText += "All settings configured! Onboarding complete.";
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
        ]
    ] as ActionExample[][]
};

export default onboardingAction;