// File: /swarm/shared/ownership/core.ts
// Updated to use world metadata instead of cache

import { logger } from "./logger";
import { IAgentRuntime } from "./types";
import { stringToUuid } from "./uuid";

export interface ServerOwnership {
  ownerId: string; // Always stored normalized
  serverId: string;
  agentId: string;
}

export interface ServerOwnershipState {
  servers: {
    [serverId: string]: ServerOwnership;
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
 * Gets or creates ownership state from world metadata
 */
export async function getOrCreateOwnershipState(
  runtime: IAgentRuntime,
  serverId: string
): Promise<ServerOwnership | null> {
  try {
    if (!serverId) {
      logger.error("Server ID is required for ownership state");
      return null;
    }

    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    const world = await runtime.getWorld(worldId);

    if (!world) {
      logger.info(`No world found for server ${serverId}`);
      return null;
    }

    // Initialize world metadata if doesn't exist
    if (!world.metadata) {
      world.metadata = {};
    }

    // If ownership doesn't exist in world metadata, return null
    if (!world.metadata.ownership?.ownerId) {
      logger.info(`No ownership data found for server ${serverId}`);
      return null;
    }

    // Return ownership data from world metadata
    return {
      ownerId: world.metadata.ownership.ownerId,
      serverId,
      agentId: runtime.agentId,
    };
  } catch (error) {
    logger.error(
      `Error getting ownership state for server ${serverId}: ${error}`
    );
    return null;
  }
}

/**
 * Finds a server where the given user is the owner
 */
export async function findServerForOwner(
  runtime: IAgentRuntime,
  userId: string
): Promise<ServerOwnership | null> {
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
    const worlds = [] // await runtime.getAllWorlds(runtime.agentId);

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
        return {
          ownerId: normalizedUserId,
          serverId: world.serverId,
          agentId: runtime.agentId,
        };
      }

      // Also check original ID format
      if (world.metadata?.ownership?.ownerId === userId) {
        logger.info(
          `Found server ${world.serverId} for owner ${userId} using original ID`
        );
        return {
          ownerId: userId,
          serverId: world.serverId,
          agentId: runtime.agentId,
        };
      }
    }

    logger.info(`No server found for owner ${normalizedUserId}`);
    return null;
  } catch (error) {
    logger.error(`Error finding server for owner: ${error}`);
    return null;
  }
}
