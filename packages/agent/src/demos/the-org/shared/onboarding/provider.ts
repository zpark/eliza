// Provide the current onboarding state
// For each setting or secret, indicate what has been set and what is missing
// At the end of the string output, indicate the next step in the onboarding process based on the first missing setting or secret
// Each setting should have a name and description
// Only validate the provider if its in a DM with a user who is an ADMIN role in a server where the agent is invited

import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { OnboardingConfig, OnboardingState } from "./types";
import { type Message } from "discord.js";

export const createOnboardingProvider = (config: OnboardingConfig): Provider => ({
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
        const channelType = discordMessage.channel.type;

        try {
            // Check channel type restrictions
            if (config.allowedChannels && 
                !config.allowedChannels.includes(channelType)) {
                return "";
            }

            // Check role requirements
            // TODO: Get this from the cache (role_state)

            // Get current onboarding state
            let onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            if (!onboardingState) {
                // Initialize onboarding state with provided settings
                onboardingState = {
                    settings: Object.entries(config.settings).reduce((acc, [key, setting]) => ({
                        ...acc,
                        [key]: {
                            ...setting,
                            value: null
                        }
                    }), {}),
                    lastUpdated: Date.now(),
                    completed: false
                };

                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState
                );
            }

            // Generate status message
            let statusMessage = "# Onboarding Status\n\n";

            // Add settings status
            for (const [key, setting] of Object.entries(onboardingState.settings)) {
                // Check if dependencies are met
                const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                    onboardingState.settings[dep]?.value !== null
                );

                if (!dependenciesMet) {
                    continue;
                }

                const status = setting.value !== null ? "✓" : "○";
                const requiredMark = setting.required ? "*" : "";
                statusMessage += `${status} ${setting.name}${requiredMark}: ${setting.value !== null ? setting.value : "Not set"}\n`;
            }

            // Add next step if not completed
            if (!onboardingState.completed) {
                const nextSetting = Object.entries(onboardingState.settings)
                    .find(([key, setting]) => {
                        if (setting.value === null) {
                            // Check if dependencies are met
                            const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                                onboardingState.settings[dep]?.value !== null
                            );
                            return dependenciesMet;
                        }
                        return false;
                    });

                if (nextSetting) {
                    statusMessage += "\n## Next Step\n";
                    statusMessage += `Configure ${nextSetting[1].name}:\n`;
                    statusMessage += `${nextSetting[1].description}\n`;
                }
            } else {
                statusMessage += "\n✓ Onboarding completed!\n";
            }

            return statusMessage;

        } catch (error) {
            logger.error("Error in onboarding provider:", error);
            return "Error retrieving onboarding status.";
        }
    }
});