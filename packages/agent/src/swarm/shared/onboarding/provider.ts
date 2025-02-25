// File: /swarm/shared/onboarding/provider.ts
// Fixed onboarding provider with more robust error handling

import {
    ChannelType,
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    logger,
} from "@elizaos/core";
import { ONBOARDING_CACHE_KEY, type OnboardingConfig, type OnboardingSetting, type OnboardingState } from "./types";
import { getOrCreateOwnershipState, recoverStateFromDiscord } from "../ownership/core";
import { findServerForOwner } from "./ownership";
/**
 * Formats a setting value for display, respecting privacy flags
 */
const formatSettingValue = (setting: OnboardingSetting, isOnboarding: boolean): string => {
    if (setting.value === null) return "Not set";
    if (setting.secret && !isOnboarding) return "****************";
    return String(setting.value);
};

/**
 * Gets the appropriate description based on context
 */
const getSettingDescription = (setting: OnboardingSetting, isOnboarding: boolean): string => {
    return isOnboarding ? setting.usageDescription : setting.description;
};

/**
 * Creates an onboarding provider with the given configuration
 * Improved error handling and state recovery
 */
export const createOnboardingProvider = (_config: OnboardingConfig): Provider => ({
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const room = await runtime.getRoom(message.roomId);
            if (!room) {
                logger.error("No room found for onboarding provider");
                return "Error: Room not found";
            }
            
            const type = room.type;
            const isOnboarding = type === ChannelType.DM;
            
            // Initialize or get ownership state first
            await getOrCreateOwnershipState(runtime);
            
            // Find server for the current user
            let serverOwnership = await findServerForOwner(runtime, message.userId);
            
            // If no server found, try to recover and retry
            if (!serverOwnership) {
                logger.info(`No server found for user ${message.userId}, attempting recovery...`);
                
                // Attempt recovery via Discord
                const recovered = await recoverStateFromDiscord(runtime);
                if (recovered) {
                    logger.info("Successfully recovered state from Discord, retrying lookup");
                    serverOwnership = await findServerForOwner(runtime, message.userId);
                }
            }
            
            // If still no server found after recovery attempts
            if (!serverOwnership) {
                logger.info(`No server ownership found for user ${message.userId} after recovery attempt`);
                return isOnboarding 
                    ? "You don't appear to have ownership of any servers. Please make sure you're using the correct account."
                    : "Error: No configuration access";
            }
            
            const serverId = serverOwnership.serverId;

            const onboardingCacheKey = ONBOARDING_CACHE_KEY.SERVER_STATE(serverId);
            
            // Get current onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
            
            if (!onboardingState) {
                logger.info(`No onboarding state found for server ${serverId}`);
                return isOnboarding
                    ? "I need to configure some settings for this server. Let's begin the setup process."
                    : "Configuration has not been completed yet.";
            }
            
            return generateStatusMessage(runtime, onboardingState, isOnboarding, state);
        } catch (error) {
            logger.error(`Critical error in onboarding provider: ${error}`);
            return "Error retrieving configuration information. Please try again later.";
        }
    }
});

/**
 * Generates a formatted status message based on current onboarding state
 */
async function generateStatusMessage(
    runtime: IAgentRuntime,
    onboardingState: OnboardingState,
    isOnboarding: boolean,
    state?: State
): Promise<string> {
    try {
        let statusMessage = "";
        
        if (isOnboarding) {
            // Private channel (DM) display - more detailed
            statusMessage += "# Onboarding Configuration\n";
            statusMessage += `Hello! I'm ${state?.agentName || runtime.character.name}, and I'm here to help get everything set up.\n\n`;
            statusMessage += "## Settings Status\n";
            
            // Group settings by status
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
            // Public channel display - limited information
            statusMessage += "# Configuration\n\n";
            
            // Only show configured public settings
            let hasPublicSettings = false;
            
            for (const [_key, setting] of Object.entries(onboardingState) as [string, OnboardingSetting][]) {
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
        logger.error(`Error generating status message: ${error}`);
        return "Error formatting configuration status.";
    }
}

export default createOnboardingProvider;