import { createUniqueUuid } from "./entities";
import { logger } from "./logger";
import type { IAgentRuntime, OnboardingConfig, OnboardingSetting, WorldData, WorldSettings } from "./types";

function createSettingFromConfig(
  configSetting: Omit<OnboardingSetting, "value">
): OnboardingSetting {
  return {
    name: configSetting.name,
    description: configSetting.description,
    usageDescription: configSetting.usageDescription || "",
    value: null,
    required: configSetting.required,
    validation: configSetting.validation || null,
    public: configSetting.public || false,
    secret: configSetting.secret || false,
    dependsOn: configSetting.dependsOn || [],
    onSetAction: configSetting.onSetAction || null,
    visibleIf: configSetting.visibleIf || null,
  };
}

/**
 * Updates settings state in world metadata
 */
export async function updateWorldSettings(
  runtime: IAgentRuntime,
  serverId: string,
  worldSettings: WorldSettings
): Promise<boolean> {
  try {
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.databaseAdapter.getWorld(worldId);

    if (!world) {
      logger.error(`No world found for server ${serverId}`);
      return false;
    }

    // Initialize metadata if it doesn't exist
    if (!world.metadata) {
      world.metadata = {};
    }

    // Update settings state
    world.metadata.settings = worldSettings;

    // Save updated world
    await runtime.databaseAdapter.updateWorld(world);

    return true;
  } catch (error) {
    logger.error(`Error updating settings state: ${error}`);
    return false;
  }
}

/**
 * Gets settings state from world metadata
 */
export async function getWorldSettings(
  runtime: IAgentRuntime,
  serverId: string
): Promise<WorldSettings | null> {
  try {
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.databaseAdapter.getWorld(worldId);

    if (!world || !world.metadata?.settings) {
      return null;
    }

    return world.metadata.settings as WorldSettings;
  } catch (error) {
    logger.error(`Error getting settings state: ${error}`);
    return null;
  }
}

/**
 * Initializes settings configuration for a server
 */
export async function initializeOnboardingConfig(
  runtime: IAgentRuntime,
  world: WorldData,
  config: OnboardingConfig
): Promise<WorldSettings | null> {
  try {
    // Check if settings state already exists
    if (world.metadata?.settings) {
      logger.info(`Onboarding state already exists for server ${world.serverId}`);
      return world.metadata.settings as WorldSettings;
    }
    
    // Create new settings state
    const worldSettings: WorldSettings = {};
    
    // Initialize settings from config
    if (config.settings) {
      for (const [key, configSetting] of Object.entries(config.settings)) {
        worldSettings[key] = createSettingFromConfig(configSetting);
      }
    }
    
    // Save settings state to world metadata
    if (!world.metadata) {
      world.metadata = {};
    }
    
    world.metadata.settings = worldSettings;
    
    await runtime.databaseAdapter.updateWorld(world);
    
    logger.info(`Initialized settings config for server ${world.serverId}`);
    return worldSettings;
  } catch (error) {
    logger.error(`Error initializing settings config: ${error}`);
    return null;
  }
}