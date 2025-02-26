import {
  ChannelType,
  type IAgentRuntime,
  initializeOnboardingConfig,
  logger,
  type OnboardingConfig,
  type OnboardingState,
  stringToUuid,
  type UUID,
} from "@elizaos/core";
import type { Guild } from "discord.js";

/**
 * Initializes all systems for a server
 */
export async function initializeAllSystems(
  runtime: IAgentRuntime,
  servers: Guild[],
  config: OnboardingConfig
): Promise<void> {
  try {
    for (const server of servers) {
      const worldId = stringToUuid(`${server.id}-${runtime.agentId}`);

      const world = await runtime.getWorld(worldId);

      // Initialize onboarding configuration
      const onboardingState = await initializeOnboardingConfig(
        runtime,
        world,
        config
      );

      if (!onboardingState) {
        logger.error(`Failed to initialize onboarding for server ${server.id}`);
        continue;
      }

      // Start onboarding DM with server owner
      await startOnboardingDM(runtime, server, onboardingState);
    }
  } catch (error) {
    logger.error(`Error initializing systems: ${error}`);
  }
}

/**
 * Starts the onboarding DM with the server owner
 */
export async function startOnboardingDM(
  runtime: IAgentRuntime,
  guild: Guild,
  onboardingState: OnboardingState
): Promise<void> {
  try {
    const owner = await guild.members.fetch(guild.ownerId);
    if (!owner) {
      logger.error(
        `Could not fetch owner with ID ${guild.ownerId} for server ${guild.id}`
      );
      throw new Error(`Could not fetch owner with ID ${guild.ownerId}`);
    }

    const onboardingMessages = [
      "Hi! I need to collect some information to get set up. Is now a good time?",
      "Hey there! I need to configure a few things. Do you have a moment?",
      "Hello! Could we take a few minutes to get everything set up?",
    ];

    const randomMessage =
      onboardingMessages[Math.floor(Math.random() * onboardingMessages.length)];
    const msg = await owner.send(randomMessage);
    const roomId = stringToUuid(`${msg.channel.id}-${runtime.agentId}`);

    await runtime.ensureRoomExists({
      id: roomId,
      name: `Chat with ${owner.user.username}`,
      source: "discord",
      type: ChannelType.DM,
      channelId: msg.channelId,
      serverId: guild.id,
    });

    await runtime.getOrCreateUser(
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

    logger.info(
      `Started onboarding DM with owner ${owner.id} for server ${guild.id}`
    );
  } catch (error) {
    logger.error(`Error starting DM with owner: ${error}`);
    throw error;
  }
}
