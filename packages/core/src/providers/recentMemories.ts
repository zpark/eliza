import { getEntityDetails } from "../entities";
import { addHeader, formatMessages, formatPosts } from "../prompts";
import { Entity, IAgentRuntime, Memory, Provider, UUID } from "../types";

export const recentMemoriesProvider: Provider = {
  name: "recentMemories",
  description: "Recent memories",
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
  ) => {
    const { roomId } = message;
    const conversationLength = runtime.getConversationLength();

    const entitiesData = await getEntityDetails({ runtime, roomId });

    // Get recent messages
    const recentMessagesData = await runtime.messageManager.getMemories({
      roomId,
      count: conversationLength,
      unique: false,
    });

    // Format recent messages for display
    const formattedRecentMessages = formatMessages({
      messages: recentMessagesData,
      actors: entitiesData,
    });

    // Format recent posts for display
    const formattedRecentPosts = formatPosts({
      messages: recentMessagesData,
      actors: entitiesData,
      conversationHeader: false,
    });

    // Create formatted text with headers
    const recentPosts =
      formattedRecentPosts && formattedRecentPosts.length > 0
        ? addHeader("# Posts in Thread", formattedRecentPosts)
        : "";

    const recentMessages =
      formattedRecentMessages && formattedRecentMessages.length > 0
        ? addHeader("# Conversation Messages", formattedRecentMessages)
        : "";

    // Get recent interactions between user and agent
    const getRecentInteractions = async (
      sourceEntityId: UUID,
      targetEntityId: UUID
    ): Promise<Memory[]> => {
      // Find all rooms where sourceEntityId and targetEntityId are participants
      const rooms = await runtime.databaseAdapter.getRoomsForParticipants([
        sourceEntityId,
        targetEntityId,
      ]);

      // Check the existing memories in the database
      return runtime.messageManager.getMemoriesByRoomIds({
        // filter out the current room id from rooms
        roomIds: rooms.filter((room) => room !== roomId),
        limit: 20,
      });
    };

    const recentInteractions =
      message.userId !== runtime.agentId
        ? await getRecentInteractions(message.userId, runtime.agentId)
        : [];

    // Format recent message interactions
    const getRecentMessageInteractions = async (
      recentInteractionsData: Memory[]
    ): Promise<string> => {
      // Format the recent messages
      const formattedInteractions = await Promise.all(
        recentInteractionsData.map(async (message) => {
          const isSelf = message.userId === runtime.agentId;
          let sender: string;
          if (isSelf) {
            sender = runtime.character.name;
          } else {
            // Lookup by tenant-specific ID since that's what's stored in the memory
            const accountId = await runtime.databaseAdapter.getEntityById(
              message.userId
            );
            sender = accountId?.metadata?.username || "unknown";
          }
          return `${sender}: ${message.content.text}`;
        })
      );

      return formattedInteractions.join("\n");
    };

    const recentMessageInteractions = await getRecentMessageInteractions(
      recentInteractions
    );

    // Format recent post interactions
    const getRecentPostInteractions = async (
      recentInteractionsData: Memory[],
      actors: Entity[]
    ): Promise<string> => {
      const formattedInteractions = formatPosts({
        messages: recentInteractionsData,
        actors,
        conversationHeader: true,
      });

      return formattedInteractions;
    };

    const recentPostInteractions = await getRecentPostInteractions(
      recentInteractions,
      entitiesData
    );

    const values = {
      recentMessagesData,
      recentMessageInteractions,
      recentPostInteractions,
      recentInteractionsData: recentInteractions,
    };

    // Combine all text sections
    const text = [recentMessages, recentPosts].filter(Boolean).join("\n\n");

    return {
      values,
      text,
    };
  },
};
