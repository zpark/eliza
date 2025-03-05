import { getEntityDetails } from "../entities";
import { addHeader, formatMessages, formatPosts } from "../prompts";
import { ChannelType, Entity, IAgentRuntime, Memory, Provider, UUID } from "../types";

export const recentMemoriesProvider: Provider = {
  name: "recentMemories",
  description: "Recent messages, interactions and other memories",
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
  ) => {
    const { roomId } = message;
    const conversationLength = runtime.getConversationLength();

    const entitiesData = await getEntityDetails({ runtime, roomId });
    
    const room = await runtime.databaseAdapter.getRoom(roomId);

    const isPostFormat = room?.type === ChannelType.FEED || room?.type === ChannelType.THREAD;

    // Get recent messages
    const recentMessagesData = await runtime.getMemoryManager("messages").getMemories({
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
      return runtime.getMemoryManager("messages").getMemoriesByRoomIds({
        // filter out the current room id from rooms
        roomIds: rooms.filter((room) => room !== roomId),
        limit: 20,
      });
    };

    const recentInteractionsData =
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
      recentInteractionsData
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
      recentInteractionsData,
      entitiesData
    );

    const data = {
      recentMessages: recentMessagesData,
      recentInteractions: recentInteractionsData,
    }

    const values = {
      recentPosts,
      recentMessages,
      recentMessageInteractions,
      recentPostInteractions,
      recentInteractions: isPostFormat ? recentPostInteractions : recentMessageInteractions,
    };

    // Combine all text sections
    const text = [isPostFormat ? recentPosts : recentMessages].filter(Boolean).join("\n\n");

    return {
      data,
      values,
      text,
    };
  },
};
