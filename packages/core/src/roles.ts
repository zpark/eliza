// File: /swarm/shared/ownership/core.ts
// Updated to use world metadata instead of cache

import { logger } from "./logger";
import { IAgentRuntime, WorldData } from "./types";
import { stringToUuid } from "./uuid";

export interface ServerOwnershipState {
  servers: {
    [serverId: string]: WorldData;
  };
}

/**
 * Normalizes user IDs to UUID format
 * Both stringToUuid and direct values are supported for robustness
 */
export function normalizeUserId(id: string): string {
  // Avoid double-conversion by checking if already a UUID format
  if (id.includes("-") && id.length === 36) {
    return id;
  }
  return stringToUuid(id);
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

    const normalizedUserId = normalizeUserId(userId);
    logger.info(
      `Looking for server where ${normalizedUserId} is owner (original ID: ${userId})`
    );

    // Get all worlds for this agent
    const worlds = await runtime.getAllWorlds();

    if (!worlds || worlds.length === 0) {
      logger.info("No worlds found for this agent");
      return null;
    }

    // Find world where the user is the owner
    for (const world of worlds) {
      if (world.metadata?.ownership?.ownerId === normalizedUserId) {
        logger.info(
          `Found server ${world.serverId} for owner ${normalizedUserId}`
        );
        return world;
      }

      // Also check original ID format
      if (world.metadata?.ownership?.ownerId === userId) {
        logger.info(
          `Found server ${world.serverId} for owner ${userId} using original ID`
        );
        return world;
      }
    }

    logger.info(`No server found for owner ${normalizedUserId}`);
    return null;
  } catch (error) {
    logger.error(`Error finding server for owner: ${error}`);
    return null;
  }
}
