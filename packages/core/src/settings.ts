import { logger } from "./logger";
import { OnboardingSetting, IAgentRuntime, WorldSettings, OnboardingConfig, WorldData } from "./types";
import { stringToUuid } from "./uuid";

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
 * Updates onboarding state in world metadata
 */
export async function updateWorldSettings(
  runtime: IAgentRuntime,
  serverId: string,
  worldSettings: WorldSettings
): Promise<boolean> {
  try {
    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    const world = await runtime.getWorld(worldId);

    if (!world) {
      logger.error(`No world found for server ${serverId}`);
      return false;
    }

    // Initialize metadata if it doesn't exist
    if (!world.metadata) {
      world.metadata = {};
    }

    // Update onboarding state
    world.metadata.onboarding = worldSettings;

    // Save updated world
    await runtime.updateWorld(world);

    return true;
  } catch (error) {
    logger.error(`Error updating onboarding state: ${error}`);
    return false;
  }
}

/**
 * Gets onboarding state from world metadata
 */
export async function getWorldSettings(
  runtime: IAgentRuntime,
  serverId: string
): Promise<WorldSettings | null> {
  try {
    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    const world = await runtime.getWorld(worldId);

    if (!world || !world.metadata?.onboarding) {
      return null;
    }

    return world.metadata.onboarding as WorldSettings;
  } catch (error) {
    logger.error(`Error getting onboarding state: ${error}`);
    return null;
  }
}

/**
 * Initializes onboarding configuration for a server
 */
export async function initializeOnboardingConfig(
  runtime: IAgentRuntime,
  world: WorldData,
  config: OnboardingConfig
): Promise<WorldSettings | null> {
  try {
    // Check if onboarding state already exists
    if (world.metadata?.onboarding) {
      logger.info(`Onboarding state already exists for server ${world.serverId}`);
      return world.metadata.onboarding as WorldSettings;
    }
    
    // Create new onboarding state
    const worldSettings: WorldSettings = {};
    
    // Initialize settings from config
    if (config.settings) {
      for (const [key, configSetting] of Object.entries(config.settings)) {
        worldSettings[key] = createSettingFromConfig(configSetting);
      }
    }
    
    // Save onboarding state to world metadata
    if (!world.metadata) {
      world.metadata = {};
    }
    
    world.metadata.onboarding = worldSettings;
    
    await runtime.updateWorld(world);
    
    logger.info(`Initialized onboarding config for server ${world.serverId}`);
    return worldSettings;
  } catch (error) {
    logger.error(`Error initializing onboarding config: ${error}`);
    return null;
  }
}