import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import type { Message } from "discord.js";
import type { OnboardingConfig, OnboardingState } from "./types";

export const createOnboardingProvider = (config: OnboardingConfig): Provider => ({
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if(!state?.discordMessage) {
            logger.error("No discord message in state");
            return "Error: No discord message found";
        }

        const discordMessage = state.discordMessage as Message;
        const userId = discordMessage.author.id;

        // Get serverId from ownership state, just like in the action
        const ownershipState = await runtime.cacheManager.get<{ servers: { [key: string]: { ownerId: string } } }>(
            'server_ownership_state'
        );

        if (!ownershipState?.servers) {
            logger.error("No ownership state found");
            return "Error: No server ownership found";
        }

        const serverEntry = Object.entries(ownershipState.servers)
            .find(([_, info]) => info.ownerId === userId);

        if (!serverEntry) {
            logger.error("User is not owner of any server");
            return "Error: No server found for user";
        }

        const [serverId] = serverEntry;
        
        try {
            // Get current onboarding state
            let onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            // Initialize state if it doesn't exist
            if (!onboardingState) {
                onboardingState = {};
                
                // Initialize each setting from config
                for (const [key, configSetting] of Object.entries(config.settings)) {
                    onboardingState[key] = {
                        name: configSetting.name,
                        description: configSetting.description,
                        value: null,
                        required: configSetting.required,
                        validation: configSetting.validation || null,
                        dependsOn: configSetting.dependsOn || [],
                        onSetAction: configSetting.onSetAction || null,
                        visibleIf: configSetting.visibleIf || null
                    };
                }

                // Save the initial state
                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState
                );
            }

            let statusMessage = `# Onboarding flow\nAs ${state.agentName} your role is to get all of the onboarding information from your boss, who is here to help you get set up.\nYou must ask your boss for the information you need, and then save it to your settings. The user can change these settings at any time.\n\n# ONBOARDING STATUS\n`;

            // Add settings status
            for (const [key, setting] of Object.entries(onboardingState)) {
                // Check if dependencies are met
                const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                    onboardingState[dep]?.value !== null
                );

                if (!dependenciesMet) {
                    continue;
                }

                const status = setting.value !== null ? "✓" : "○";
                const requiredMark = setting.required ? "*" : "";
                statusMessage += `${status} ${setting.name}${requiredMark}: ${setting.value !== null ? setting.value : "Not set"}\n`;
            }

            // Check if all required settings are completed
            const completed = Object.values(onboardingState).every(setting => 
                setting.value !== null || !setting.required
            );

            if (!completed) {
                // Find next unconfigured setting
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

                if (nextSetting) {
                    const [_, setting] = nextSetting;
                    statusMessage += "\n## Next Step\n";
                    statusMessage += `Configure ${setting.name}:\n`;
                    statusMessage += `${setting.description}\n`;
                }
            } else {
                statusMessage += "\n✓ Onboarding completed! All required settings are configured.\n";
            }

            return statusMessage;

        } catch (error) {
            logger.error("Error in onboarding provider:", error);
            return "Error retrieving onboarding status.";
        }
    }
});

export default createOnboardingProvider;