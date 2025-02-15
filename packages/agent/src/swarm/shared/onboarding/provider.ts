import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { Message, ChannelType } from "discord.js";
import type { OnboardingConfig, OnboardingState, OnboardingSetting } from "./types";

const formatSettingValue = (setting: OnboardingSetting, isOnboarding: boolean): string => {
    if (setting.value === null) return "Not set";
    if (setting.secret && !isOnboarding) return "****************";
    return String(setting.value);
};

const getSettingDescription = (setting: any, isOnboarding: boolean): string => {
    return isOnboarding ? setting.usageDescription : setting.description;
};

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
        const isOnboarding = discordMessage.channel.type === ChannelType.DM;
        const userId = discordMessage.author.id;

        // Get serverId from ownership state
        const ownershipState = await runtime.cacheManager.get(
            'server_ownership_state'
        ) as { servers: { [key: string]: { ownerId: string } } };

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
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${serverId}_onboarding_state`
            );

            if (!onboardingState) {
                logger.error("No onboarding state found");
                return "Error: No configuration found";
            }

            let statusMessage = "";

            if (isOnboarding) {
                // Private channel (DM) display
                statusMessage += `# Onboarding Configuration\n`;
                statusMessage += `Hello! I'm ${state.agentName}, and I'm here to help get everything set up.\n\n`;
                statusMessage += "## Settings Status\n";

                // Group settings
                const configuredSettings = [];
                const requiredUnconfigured = [];
                const optionalUnconfigured = [];

                for (const [key, setting] of Object.entries(onboardingState) as [string, OnboardingSetting][]) {
                    const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                        onboardingState[dep]?.value !== null
                    );

                    if (!dependenciesMet) continue;
                    if (setting.visibleIf && !setting.visibleIf(onboardingState)) continue;

                    const settingDisplay = {
                        key,
                        ...setting,
                        displayValue: formatSettingValue(setting, true),
                        displayDescription: getSettingDescription(setting, true)
                    };

                    if (setting.value !== null) {
                        configuredSettings.push(settingDisplay);
                    } else if (setting.required) {
                        requiredUnconfigured.push(settingDisplay);
                    } else {
                        optionalUnconfigured.push(settingDisplay);
                    }
                }

                // Display configured settings
                if (configuredSettings.length > 0) {
                    statusMessage += "\n### Configured Settings\n";
                    for (const setting of configuredSettings) {
                        statusMessage += `✓ ${setting.name} - ${setting.displayDescription}\n`;
                        statusMessage += `  Current value: ${setting.displayValue}\n`;
                    }
                }

                // Display required unconfigured settings
                if (requiredUnconfigured.length > 0) {
                    statusMessage += "\n### Required Settings (Not Configured)\n";
                    for (const setting of requiredUnconfigured) {
                        statusMessage += `○ ${setting.name} - ${setting.displayDescription}\n`;
                    }
                }

                // Display optional settings
                if (optionalUnconfigured.length > 0) {
                    statusMessage += "\n### Optional Settings\n";
                    for (const setting of optionalUnconfigured) {
                        statusMessage += `○ ${setting.name} - ${setting.displayDescription}\n`;
                    }
                }

                // Next steps
                const allRequired = requiredUnconfigured.length === 0;
                
                if (!allRequired) {
                    statusMessage += "\n## Next Step\n";
                    const nextSetting = requiredUnconfigured[0];
                    statusMessage += `Please configure ${nextSetting.name}:\n`;
                    statusMessage += `${nextSetting.displayDescription}\n`;
                } else if (optionalUnconfigured.length > 0) {
                    statusMessage += "\n## Optional Setup\n";
                    statusMessage += "All required settings are configured! Would you like to configure any optional settings?\n";
                } else {
                    statusMessage += "\n## Setup Complete!\n";
                    statusMessage += "All settings have been configured. You can always update these settings later.\n";
                }
            } else {
                // Public channel display
                statusMessage += "# Configuration\n\n";

                // Only show configured public settings
                let hasPublicSettings = false;
                
                for (const [key, setting] of Object.entries(onboardingState) as [string, OnboardingSetting][]) {
                    // Skip if not public or not configured
                    if (!setting.public || setting.value === null) continue;
                    
                    // Check dependencies
                    const dependenciesMet = !setting.dependsOn || setting.dependsOn.every(dep => 
                        onboardingState[dep]?.value !== null
                    );
                    if (!dependenciesMet) continue;
                    
                    // Check visibility condition
                    if (setting.visibleIf && !setting.visibleIf(onboardingState)) continue;

                    hasPublicSettings = true;
                    statusMessage += `**${setting.name}**: ${formatSettingValue(setting, false)}\n`;
                }

                if (!hasPublicSettings) {
                    statusMessage += "No public configuration settings available.";
                }
            }

            return statusMessage;

        } catch (error) {
            logger.error("Error in onboarding provider:", error);
            return "Error retrieving onboarding status.";
        }
    }
});

export default createOnboardingProvider;