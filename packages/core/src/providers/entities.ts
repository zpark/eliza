import { addHeader } from "../prompts";
import { formatEntities, getEntityDetails } from "../entities";
import type { Entity, IAgentRuntime, Memory, Provider } from "../types";

export const entitiesProvider: Provider = {
  name: "ENTITIES",
  description: "Entities in the current conversation",
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const { roomId, userId } = message;

    // Get entities details
    const entitiesData = await getEntityDetails({ runtime, roomId });

    // Format entities for display
    const formattedActors = formatEntities({ actors: entitiesData ?? [] });

    // Find sender name
    const senderName = entitiesData?.find((actor: Entity) => actor.id === userId)
      ?.names[0];

    // Create formatted text with header
    const actors =
      formattedActors && formattedActors.length > 0
        ? addHeader("# Actors in the Room", formattedActors)
        : "";

    const data = {
      entitiesData,
      senderName,
    };

    const values = {
      actors,
    };

    return {
      data,
      values,
      text: actors,
    };
  },
};
