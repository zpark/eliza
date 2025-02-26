// File: /swarm/shared/onboarding/provider.ts
// Updated to use world metadata instead of cache

import { logger } from "../logger";
import { findServerForOwner } from "../roles";
import { getWorldSettings } from "../settings";
import {
    ChannelType,
    IAgentRuntime,
    Memory,
    Provider,
    State,
    type OnboardingSetting,
    type WorldSettings
} from "../types";

/**
 * Formats a setting value for display, respecting privacy flags
 */
const formatSettingValue = (
  setting: OnboardingSetting,
  isOnboarding: boolean
): string => {
  if (setting.value === null) return "Not set";
  if (setting.secret && !isOnboarding) return "****************";
  return String(setting.value);
};

/**
 * Generates a status message based on the current onboarding state
 */
function generateStatusMessage(
  runtime: IAgentRuntime,
  worldSettings: WorldSettings,
  isOnboarding: boolean,
  state?: State
): string {
  try {
    // Format settings for display
    const formattedSettings = Object.entries(worldSettings)
      .map(([key, setting]) => {
        if (typeof setting !== "object" || !setting.name) return null;

        const description = setting.description || "";
        const usageDescription = setting.usageDescription || "";

        // Skip settings that should be hidden based on visibility function
        if (setting.visibleIf && !setting.visibleIf(worldSettings)) {
          return null;
        }

        return {
          name: setting.name,
          value: formatSettingValue(setting, isOnboarding),
          description,
          usageDescription,
          required: setting.required,
          configured: setting.value !== null,
        };
      })
      .filter(Boolean);

    // Count required settings that are not configured
    const requiredUnconfigured = formattedSettings.filter(
      (s) => s.required && !s.configured
    ).length;

    // Generate appropriate message
    if (isOnboarding) {
      if (requiredUnconfigured > 0) {
        return (
          `# PRIORITY TASK: Onboarding with ${state.senderName}\n${state.agentName} still needs to configure ${requiredUnconfigured} required settings:\n\n` +
          formattedSettings
            .filter((s) => s.required && !s.configured)
            .map((s) => `${s.name}: ${s.usageDescription}\nCurrent value: ${s.value}`)
            .join("\n\n") +
          "\n\n" +
          `If the user gives any information related to the settings, ${state.agentName} should use the UPDATE_SETTINGS action to update the settings with this new information. ${state.agentName} can update any, some or all settings.`
        );
      } else {
        return (
          "All required settings have been configured! Here's the current configuration:\n\n" +
          formattedSettings.map((s) => `- ${s.name}: ${s.value}`).join("\n")
        );
      }
    } else {
      // Non-onboarding context - more concise
      return (
        "Current configuration status: " +
        (requiredUnconfigured > 0
          ? `${requiredUnconfigured} required settings need configuration.`
          : "All required settings configured.")
      );
    }
  } catch (error) {
    logger.error(`Error generating status message: ${error}`);
    return "Error generating configuration status.";
  }
}

/**
 * Creates an onboarding provider with the given configuration
 * Updated to use world metadata instead of cache
 */
export const settingsProvider: Provider = {
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

      // Find server for the current user
      let serverOwnership = await findServerForOwner(runtime, message.userId);

      // If still no server found after recovery attempts
      if (!serverOwnership) {
        logger.info(
          `No server ownership found for user ${message.userId} after recovery attempt`
        );
        return isOnboarding
          ? "You don't appear to have ownership of any servers. Please make sure you're using the correct account."
          : "Error: No configuration access";
      }

      const serverId = serverOwnership.serverId;

      // Get current onboarding state from world metadata
      const worldSettings = await getWorldSettings(runtime, serverId);

      if (!worldSettings) {
        logger.info(`No onboarding state found for server ${serverId}`);
        return isOnboarding
          ? "I need to configure some settings for this server. Let's begin the setup process."
          : "Configuration has not been completed yet.";
      }

      const output = generateStatusMessage(
        runtime,
        worldSettings,
        isOnboarding,
        state
      );

      return output;
    } catch (error) {
      logger.error(`Critical error in onboarding provider: ${error}`);
      return "Error retrieving configuration information. Please try again later.";
    }
  },
};
