// File: /swarm/shared/ownership/core.ts
// Updated to use world metadata instead of cache

import { createUniqueUuid } from "./entities";
import { logger } from "./logger";
import { RoleName, type IAgentRuntime, type WorldData } from "./types";

export interface ServerOwnershipState {
  servers: {
    [serverId: string]: WorldData;
  };
}


/**
 * Gets a user's role from world metadata
 */
export async function getUserServerRole(
  runtime: IAgentRuntime,
  userId: string,
  serverId: string
): Promise<RoleName> {
  try {
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.databaseAdapter.getWorld(worldId);

    if (!world || !world.metadata?.roles) {
      return RoleName.NONE;
    }

    if (world.metadata.roles[userId]?.role) {
      return world.metadata.roles[userId].role as RoleName;
    }

    // Also check original ID format
    if (world.metadata.roles[userId]?.role) {
      return world.metadata.roles[userId].role as RoleName;
    }

    return RoleName.NONE;
  } catch (error) {
    logger.error(`Error getting user role: ${error}`);
    return RoleName.NONE;
  }
}

/**
 * Finds a server where the given user is the owner
 */
export async function findWorldForOwner(
  runtime: IAgentRuntime,
  userId: string
): Promise<WorldData | null> {
  try {
    if (!userId) {
      logger.error("User ID is required to find server");
      return null;
    }

    // Get all worlds for this agent
    const worlds = await runtime.databaseAdapter.getAllWorlds();

    if (!worlds || worlds.length === 0) {
      logger.info("No worlds found for this agent");
      return null;
    }

    // Find world where the user is the owner
    for (const world of worlds) {
      if (world.metadata?.ownership?.ownerId === userId) {
        return world;
      }
    }

    logger.info(`No server found for owner ${userId}`);
    return null;
  } catch (error) {
    logger.error(`Error finding server for owner: ${error}`);
    return null;
  }
}
