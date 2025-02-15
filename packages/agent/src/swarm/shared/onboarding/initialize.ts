import {
    Content,
    logger,
    stringToUuid,
    type UUID,
    type IAgentRuntime,
  } from "@elizaos/core";
  import type { Client } from "discord.js";
  import {
    ROLE_CACHE_KEYS,
    RoleName,
    type ServerRoleState,
    type UserRole,
  } from "../role/types";
  import type {
    OnboardingSetting,
    OnboardingConfig,
    OnboardingState,
  } from "./types";
  import onboardingAction from "./action";
  import { createOnboardingProvider } from "./provider";
  import { registerServerOwner } from "./ownership";
  import type { Guild } from "discord.js";
  
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
  
  async function initializeRoleState(
    runtime: IAgentRuntime,
    serverId: string,
    ownerId: string
  ): Promise<void> {
    const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(serverId);
    let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);
  
    if (!roleState) {
      roleState = {
        roles: {
          [ownerId]: {
            userId: ownerId,
            serverId: serverId,
            role: RoleName.OWNER
          }
        },
        lastUpdated: Date.now()
      };
      
      await runtime.cacheManager.set(cacheKey, roleState);
      logger.info(`Initialized role state for server ${serverId} with owner ${ownerId}`);
    }
  }
  
  async function fetchGuildWithRetry(
    discordClient: Client,
    serverId: string,
    maxRetries: number = 5
  ): Promise<Guild> {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const guild = await discordClient.guilds.fetch({
          guild: serverId,
          withCounts: true,
        });
        
        if (!guild.ownerId || !guild.members) {
          throw new Error("Incomplete guild data");
        }
        
        return guild;
      } catch (error) {
        lastError = error;
        logger.warn(`Retry ${i + 1}/${maxRetries} failed for guild fetch`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw lastError;
  }
  
  export async function initializeOnboarding(
    runtime: IAgentRuntime,
    serverId: string,
    config: OnboardingConfig
  ): Promise<void> {
    try {
      // Register providers first
      runtime.registerAction(onboardingAction);
      runtime.registerProvider(createOnboardingProvider(config));
  
      // Get Discord client
      const discordClient = (runtime.getClient("discord") as any).client as Client;
  
      // Fetch guild data with retry
      const guild = await fetchGuildWithRetry(discordClient, serverId);
      const ownerId = guild.ownerId;
  
      // Register server owner and initialize role state
      await Promise.all([
        registerServerOwner(runtime, serverId, ownerId),
        initializeRoleState(runtime, serverId, ownerId)
      ]);
  
      // Get or initialize onboarding state
      let onboardingState = await runtime.cacheManager.get<OnboardingState>(
        `server_${serverId}_onboarding_state`
      );
  
      if (!onboardingState || Object.keys(onboardingState).length === 0) {
        // Initialize state with config settings
        onboardingState = {};
        for (const [key, configSetting] of Object.entries(config.settings)) {
          onboardingState[key] = createSettingFromConfig(configSetting);
        }
  
        // Save initial state
        await runtime.cacheManager.set(
          `server_${serverId}_onboarding_state`,
          onboardingState
        );
  
        // Start DM with owner
        const owner = await guild.members.fetch(ownerId);
        const onboardingMessages = [
          "Hi! I need to collect some information to get set up. Is now a good time?",
          "Hey there! I need to configure a few things. Do you have a moment?",
          "Hello! Could we take a few minutes to get everything set up?",
        ];
  
        const randomMessage = onboardingMessages[Math.floor(Math.random() * onboardingMessages.length)];
        const msg = await owner.send(randomMessage);
        const roomId = stringToUuid(msg.channelId + "-" + runtime.agentId);
  
        // Create memory of the initial message
        await runtime.messageManager.createMemory({
          agentId: runtime.agentId as UUID,
          userId: stringToUuid(owner.id) as UUID,
          roomId: roomId,
          content: {
            text: randomMessage,
            action: "BEGIN_ONBOARDING",
          },
          createdAt: Date.now(),
        });
      }
  
      logger.info(`Successfully initialized onboarding for server ${serverId}`);
    } catch (error) {
      logger.error(`Failed to initialize onboarding for server ${serverId}:`, error);
      throw error;
    }
  }