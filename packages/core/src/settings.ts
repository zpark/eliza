import { logger } from "./logger";
import { OnboardingSetting, IAgentRuntime, OnboardingState, OnboardingConfig, WorldData } from "./types";
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
export async function updateOnboardingState(
  runtime: IAgentRuntime,
  serverId: string,
  onboardingState: OnboardingState
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
    world.metadata.onboarding = onboardingState;

    // Save updated world
    await runtime.databaseAdapter.updateWorld(world, runtime.agentId);

    return true;
  } catch (error) {
    logger.error(`Error updating onboarding state: ${error}`);
    return false;
  }
}

/**
 * Gets onboarding state from world metadata
 */
export async function getOnboardingState(
  runtime: IAgentRuntime,
  serverId: string
): Promise<OnboardingState | null> {
  try {
    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    const world = await runtime.getWorld(worldId);

    if (!world || !world.metadata?.onboarding) {
      return null;
    }

    return world.metadata.onboarding as OnboardingState;
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
): Promise<OnboardingState | null> {
  try {
    // Check if onboarding state already exists
    if (world.metadata?.onboarding) {
      logger.info(`Onboarding state already exists for server ${world.serverId}`);
      return world.metadata.onboarding as OnboardingState;
    }
    
    // Create new onboarding state
    const onboardingState: OnboardingState = {};
    
    // Initialize settings from config
    if (config.settings) {
      for (const [key, configSetting] of Object.entries(config.settings)) {
        onboardingState[key] = createSettingFromConfig(configSetting);
      }
    }
    
    // Save onboarding state to world metadata
    if (!world.metadata) {
      world.metadata = {};
    }
    
    world.metadata.onboarding = onboardingState;
    
    await runtime.databaseAdapter.updateWorld(world, runtime.agentId);
    
    logger.info(`Initialized onboarding config for server ${world.serverId}`);
    return onboardingState;
  } catch (error) {
    logger.error(`Error initializing onboarding config: ${error}`);
    return null;
  }
}