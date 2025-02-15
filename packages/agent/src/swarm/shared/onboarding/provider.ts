import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { type Message } from "discord.js";
import { OnboardingConfig, OnboardingState } from "./types";

export const createOnboardingProvider = (config: OnboardingConfig): Provider => ({
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        console.log("*** get onboarding provider");

        if(!state?.discordMessage) {
            logger.error("No discord message in state");
            return "Error: No discord message found";
        }

        const discordMessage = state.discordMessage as Message;
        let serverId;

        // Get server ID from either guild or DM channel
        if (discordMessage.guild?.id) {
            serverId = discordMessage.guild.id;
        } else if (discordMessage.channel.isDMBased()) {
            serverId = discordMessage.channel.id;
        } else {
            logger.error("No valid server ID found");
            return "Error: Could not determine server ID";
        }

        console.log("*** serverId", serverId);
        
        try {
            // Get current onboarding state
            let onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            console.log("*** onboardingState after init", onboardingState);

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

                console.log("*** initialized new onboarding state:", onboardingState);
            }

            // Generate status message
            console.log("Generating onboarding status message");
            console.log("*** onboardingState", onboardingState);

            let statusMessage = `# Onboarding flow\nAs ${state.agentName} your role is to get all of the onboarding information from your boss, who is here to help you get set up.\nYou must ask your boss for the information you need, and then save it to your settings. The user can change these settings at any time.\n\n# ONBOARDING STATUS\n`;

            // Add settings status
            for (const [key, setting] of Object.entries(onboardingState)) {
                console.log("*** key", key);
                console.log("*** setting", setting);
                // Check if dependencies are met
                const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                    onboardingState[dep]?.value !== null
                );
                console.log("*** dependenciesMet", dependenciesMet);

                if (!dependenciesMet) {
                    continue;
                }

                console.log("*** setting.value", setting.value);

                const status = setting.value !== null ? "✓" : "○";
                const requiredMark = setting.required ? "*" : "";
                statusMessage += `${status} ${setting.name}${requiredMark}: ${setting.value !== null ? setting.value : "Not set"}\n`;
            }

            // Check if all required settings are completed
            const completed = Object.values(onboardingState).every(setting => 
                setting.value !== null || !setting.required
            );

            console.log("*** completed", completed);

            if (!completed) {
                console.log("*** finding next setting");
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
                    console.log("*** found next setting");
                    const [_, setting] = nextSetting;
                    statusMessage += "\n## Next Step\n";
                    statusMessage += `Configure ${setting.name}:\n`;
                    statusMessage += `${setting.description}\n`;
                }
            } else {
                statusMessage += "\n✓ Onboarding completed! All required settings are configured.\n";
            }

            console.log("*** statusMessage", statusMessage);

            return statusMessage;

        } catch (error) {
            logger.error("Error in onboarding provider:", error);
            return "Error retrieving onboarding status.";
        }
    }
});

export default createOnboardingProvider;