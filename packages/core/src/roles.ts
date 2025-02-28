// File: /swarm/shared/ownership/core.ts
// Updated to use world metadata instead of cache

import { logger } from "./logger";
import type { IAgentRuntime, WorldData } from "./types";

export interface ServerOwnershipState {
  servers: {
    [serverId: string]: WorldData;
  };
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
    const worlds = await runtime.getAllWorlds();

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
