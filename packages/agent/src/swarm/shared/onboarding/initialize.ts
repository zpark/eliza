import {
  ChannelType,
  logger,
  stringToUuid,
  type IAgentRuntime,
  type UUID
} from "@elizaos/core";
import type { Guild } from "discord.js";
import { getOrCreateOwnershipState } from "../ownership/core";
import {
  ROLE_CACHE_KEYS,
  RoleName,
  type ServerRoleState
} from "../role/types";
import onboardingAction from "./action";
import { registerServerOwner } from "./ownership";
import { createOnboardingProvider } from "./provider";
import {
  getOnboardingCacheKey,
  ONBOARDING_CACHE_KEY,
  type OnboardingConfig,
  type OnboardingSetting,
  type OnboardingState
} from "./types";
  
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
 * Enhanced initialization for all systems with proper state management
 * Ensures consistent state across components
 */
export async function initializeAllSystems(
  runtime: IAgentRuntime, 
  guilds: Guild[],
  config: OnboardingConfig
): Promise<void> {
  try {
    // Ensure we always have valid guilds
    const validGuilds = guilds.filter(guild => guild && guild.id && guild.ownerId);
    
    if (validGuilds.length === 0) {
      logger.warn('No valid guilds provided for initialization');
      return;
    }
    
    logger.info(`Starting initialization for ${validGuilds.length} guilds`);
    
    // 1. Ensure ownership state exists first
    await getOrCreateOwnershipState(runtime);
    
    // 2. Process each guild with proper error isolation
    const processedGuilds: string[] = [];
    
    for (const guild of validGuilds) {
      try {
        // 3. Register server owner directly from here
        if (guild.id && guild.ownerId) {
          try {
            await registerServerOwner(runtime, guild.id, guild.ownerId);
            logger.info(`Registered server ${guild.id} owner ${guild.ownerId} during initialization`);
          } catch (ownershipError) {
            logger.error(`Error registering ownership for guild ${guild.id}: ${ownershipError}`);
            // Continue even if ownership registration fails
          }
        }
        
        // 4. Initialize role state
        await initializeRoleState(runtime, guild.id, guild.ownerId);
        
        // 5. Initialize onboarding
        await initializeOnboarding(runtime, guild, config);
        
        processedGuilds.push(guild.id);
      } catch (error) {
        logger.error(`Error processing guild ${guild?.id}: ${error}`);
        // Continue with other guilds even if one fails
      }
    }
    
    // 6. Register global actions and providers just once
    registerGlobalHandlers(runtime, config);
    
    logger.info(`Successfully initialized ${processedGuilds.length} guilds: ${processedGuilds.join(', ')}`);
  } catch (error) {
    logger.error(`Failed to initialize systems: ${error}`);
  }
}

/**
 * Registers global handlers (actions and providers)
 * Extracted to avoid duplicate registrations
 */
function registerGlobalHandlers(
  runtime: IAgentRuntime,
  config: OnboardingConfig
): void {
  // Only register these once to avoid duplicates
  try {
    runtime.registerAction(onboardingAction);
    runtime.registerProvider(createOnboardingProvider(config));
    logger.info('Registered global handlers successfully');
  } catch (error) {
    logger.error(`Error registering global handlers: ${error}`);
  }
}

// 4. Fix for shared/role/initialize.ts - Improve role state initialization
export async function initializeRoleState(
  runtime: IAgentRuntime,
  serverId: string,
  ownerId: string
): Promise<void> {
  try {
    const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
    let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);

    if (!roleState) {
      // Create new role state
      // Store both UUID and original ID for compatibility
      const ownerUuid = stringToUuid(ownerId);
      
      roleState = {
        roles: {
          // Store by UUID
          [ownerUuid]: {
            userId: ownerUuid,
            serverId: serverId,
            role: RoleName.OWNER
          },
          // Also store by original ID for backwards compatibility
          [ownerId]: {
            userId: ownerId,
            serverId: serverId,
            role: RoleName.OWNER
          }
        },
      };
      
      await runtime.cacheManager.set(cacheKey, roleState);
      logger.info(`Initialized role state for server ${serverId} with owner ${ownerId} (UUID: ${ownerUuid})`);
    } else {
      // Ensure roles object exists
      if (!roleState.roles) {
        roleState.roles = {};
      }
      
      // Ensure owner has OWNER role (store both formats)
      const ownerUuid = stringToUuid(ownerId);
      
      if (!roleState.roles[ownerUuid]) {
        // Add UUID format
        roleState.roles[ownerUuid] = {
          userId: ownerUuid,
          serverId: serverId,
          role: RoleName.OWNER
        };
        
        // Add original ID format
        roleState.roles[ownerId] = {
          userId: ownerId,
          serverId: serverId,
          role: RoleName.OWNER
        };
        
        await runtime.cacheManager.set(cacheKey, roleState);
        logger.info(`Updated role state for server ${serverId} with owner ${ownerId} (UUID: ${ownerUuid})`);
      }
    }
  } catch (error) {
    logger.error(`Failed to initialize role state for server ${serverId}:`, error);
    throw error;
  }
}

export async function initializeOnboarding(
  runtime: IAgentRuntime,
  guild: Guild,
  config: OnboardingConfig
): Promise<void> {
  const serverId = guild.id;
  try {
    if (!serverId || !guild.ownerId) {
      throw new Error(`Invalid guild data: serverId=${serverId}, ownerId=${guild.ownerId}`);
    }
    
    logger.info(`Initializing onboarding for server ${serverId}`);
    
    // Use helper function to ensure consistent cache key
    const onboardingCacheKey = getOnboardingCacheKey(serverId);
    logger.info(`Using cache key: ${onboardingCacheKey}`);
    
    // Check if onboarding state already exists
    let onboardingState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
    console.log("*** ONBOARDING STATE ***", onboardingState);
    if (!onboardingState) {
      // Initialize state with config settings
      onboardingState = {};
      for (const [key, configSetting] of Object.entries(config.settings)) {
        onboardingState[key] = createSettingFromConfig(configSetting);
      }

      logger.info(`Created new onboarding state for server ${serverId}`);
      console.log("*** CREATED ONBOARDING STATE ***", onboardingState);

      // Save with explicit cache key and verify it was saved
      await runtime.cacheManager.set(onboardingCacheKey, onboardingState);
      
      // Verify save was successful
      const verifyState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
      if (!verifyState) {
        logger.error(`Failed to verify onboarding state was saved for server ${serverId}`);
      } else {
        logger.info(`Verified onboarding state was saved for server ${serverId}`);
      }

      // Start DM with owner
      try {
        await startOnboardingDM(runtime, guild, onboardingState);
      } catch (error) {
        logger.error(`Error starting DM with owner: ${error}`);
      }
    } else {
      logger.info(`Found existing onboarding state for server ${serverId}`);
    }

    logger.info(`Successfully initialized onboarding for server ${serverId}`);
  } catch (error) {
    logger.error(`Failed to initialize onboarding for server ${serverId}: ${error}`);
  }
}


/**
 * Starts the onboarding DM with the server owner
 */
async function startOnboardingDM(
  runtime: IAgentRuntime,
  guild: Guild,
  onboardingState: OnboardingState
): Promise<void> {
  try {
    const owner = await guild.members.fetch(guild.ownerId);
    if (!owner) {
      logger.error(`Could not fetch owner with ID ${guild.ownerId} for server ${guild.id}`);
      throw new Error(`Could not fetch owner with ID ${guild.ownerId}`);
    }
    
    const onboardingMessages = [
      "Hi! I need to collect some information to get set up. Is now a good time?",
      "Hey there! I need to configure a few things. Do you have a moment?",
      "Hello! Could we take a few minutes to get everything set up?",
    ];
    
    const randomMessage = onboardingMessages[Math.floor(Math.random() * onboardingMessages.length)];
    const msg = await owner.send(randomMessage);
    const roomId = stringToUuid(msg.channel.id + "-" + runtime.agentId);
    
    await runtime.ensureRoomExists({
      id: roomId, 
      name: "Chat with " + owner.user.username, 
      source: "discord", 
      type: ChannelType.DM, 
      channelId: msg.channelId, 
      serverId: guild.id
    });
    
    await runtime.ensureUserExists(
      runtime.agentId, 
      runtime.character.name, 
      runtime.character.name, 
      "discord"
    );
    
    // Create memory of the initial message
    await runtime.messageManager.createMemory({
      agentId: runtime.agentId as UUID,
      userId: runtime.agentId as UUID,
      roomId: roomId,
      content: {
        text: randomMessage,
        action: "BEGIN_ONBOARDING",
      },
      createdAt: Date.now(),
    });
    
    logger.info(`Started onboarding DM with owner ${owner.id} for server ${guild.id}`);
  } catch (error) {
    logger.error(`Error starting DM with owner: ${error}`);
    throw error;
  }
}