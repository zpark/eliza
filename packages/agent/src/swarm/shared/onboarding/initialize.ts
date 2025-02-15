// src/shared/onboarding/initialize.ts
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
import onboardingProvider from "./provider";
import { registerServerOwner } from "./ownership";
import type { Guild } from "discord.js";
// Helper to create a proper setting object
function createSettingFromConfig(
  configSetting: Omit<OnboardingSetting, "value">
): OnboardingSetting {
  return {
    name: configSetting.name,
    description: configSetting.description,
    value: null,
    required: configSetting.required,
    validation: configSetting.validation || null,
    dependsOn: configSetting.dependsOn || [],
    onSetAction: configSetting.onSetAction || null,
    visibleIf: configSetting.visibleIf || null,
  };
}

export async function setUserServerRole(
  runtime: IAgentRuntime,
  userRole: UserRole
): Promise<void> {
  try {
    const cacheKey = ROLE_CACHE_KEYS.SERVER_ROLES(userRole.serverId);
    let roleState = await runtime.cacheManager.get<ServerRoleState>(cacheKey);

    if (!roleState) {
      roleState = {
        roles: {},
        lastUpdated: Date.now(),
      };
    }

    roleState.roles[userRole.userId] = userRole;
    roleState.lastUpdated = Date.now();

    await runtime.cacheManager.set(cacheKey, roleState);

    // Log role change
    await runtime.databaseAdapter.log({
      body: {
        type: "role_update",
        targetUser: userRole.userId,
        serverId: userRole.serverId,
        newRole: userRole.role,
      },
      userId: runtime.agentId,
      roomId: userRole.serverId as UUID,
      type: "role_management",
    });
  } catch (error) {
    logger.error("Error setting user role:", error);
    throw error;
  }
}

export async function initializeOnboarding(
  runtime: IAgentRuntime,
  serverId: string,
  config: OnboardingConfig
): Promise<void> {
  try {
    runtime.registerAction(onboardingAction);
    runtime.registerProvider(onboardingProvider);

    // Retry handler for guild data
    let retries = 0;
    const maxRetries = 5;
    const discordClient = (runtime.getClient("discord") as any)
      .client as Client;

    let guild = (await discordClient.guilds.fetch({
      guild: serverId,
      withCounts: true,
    })) as Guild;

    // Get Discord client and server info
    guild = (await discordClient.guilds.fetch({
      guild: serverId,
      withCounts: true,
    })) as Guild;

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between retries
    guild = (await discordClient.guilds.fetch({
      guild: serverId,
      withCounts: true,
    })) as Guild;
    retries++;

    if (!guild.ownerId || !guild.members) {
      throw new Error("Failed to fetch guild data after retries");
    }

    const ownerId = guild.ownerId;

    // Register server owner
    await registerServerOwner(runtime, serverId, guild.ownerId);

    // Initialize onboarding state if it doesn't exist
    const existingState = await runtime.cacheManager.get<OnboardingState>(
      `server_${serverId}_onboarding_state`
    );

    if (!existingState || Object.keys(existingState).length === 0) {
      // Initialize onboarding state with config settings
      const initialState: OnboardingState = {};

      // Properly construct each setting
      for (const [key, configSetting] of Object.entries(config.settings)) {
        initialState[key] = createSettingFromConfig(configSetting);
      }

      // Save initial state
      await runtime.cacheManager.set(
        `server_${serverId}_onboarding_state`,
        initialState
      );

      // Start DM with owner
      const owner = await guild.members.fetch(guild.ownerId);
      const onboardingMessages = [
        "Hi! I need to collect some information to get set up. Is now a good time?",
        "Hey there! I need to configure a few things. Do you have a moment?",
        "Hello! Could we take a few minutes to get everything set up?",
      ];

      const randomMessage =
        onboardingMessages[
          Math.floor(Math.random() * onboardingMessages.length)
        ];

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

    logger.info(`Initialized onboarding for server ${serverId}`);
  } catch (error) {
    logger.error(
      `Failed to initialize onboarding for server ${serverId}:`,
      error
    );
    throw error;
  }
}

// Helper to check if a user can access onboarding
export async function canAccessOnboarding(
  runtime: IAgentRuntime,
  userId: string,
  serverId: string,
  config: OnboardingConfig
): Promise<boolean> {
  const roleState = await runtime.cacheManager.get<ServerRoleState>(
    ROLE_CACHE_KEYS.SERVER_ROLES(serverId)
  );

  if (!roleState?.roles[userId]) {
    return false;
  }

  const userRole = roleState.roles[userId].role;
  return userRole === RoleName.OWNER || userRole === RoleName.ADMIN;
}
