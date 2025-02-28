import {
  ChannelType,
  Client,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  UUID,
  createUniqueUuid
} from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";

export class ScenarioClient implements Client {
  name = "scenario";
  runtime: IAgentRuntime;
  private messageHandlers: Map<UUID, HandlerCallback[]> = new Map();
  private rooms: Map<string, { roomId: UUID }> = new Map();

  async start(runtime: IAgentRuntime) {
    this.runtime = runtime;
    return this;
  }

  async stop() {
    this.messageHandlers.clear();
    this.rooms.clear();
  }

  // Create a room for an agent
  async createRoom(agentId: string, name?: string) {
    const roomId = uuidv4();

    await this.runtime.ensureRoomExists({
      id: roomId as UUID,
      name: name || `Room for ${agentId}`,
      source: "scenario",
      type: ChannelType.GROUP,
      channelId: roomId,
      serverId: null,
    });

    this.rooms.set(agentId, { roomId: roomId as UUID });
  }

  // Save a message in all agents' memory without emitting events
  async saveMessage(
    sender: IAgentRuntime,
    receivers: IAgentRuntime[],
    text: string
  ) {
    
    for (const receiver of receivers) {
      const roomData = this.rooms.get(receiver.agentId);
      if (!roomData) continue;
      const userId = createUniqueUuid(receiver, sender.agentId)
      
        // Ensure connection exists
        await receiver.ensureConnection({
          userId,
          roomId: roomData.roomId,
          userName: sender.character.name,
          userScreenName: sender.character.name,
          source: "scenario",
          type: ChannelType.GROUP,
        });

      const memory: Memory = {
        userId,
        agentId: receiver.agentId,
        roomId: roomData.roomId,
        content: {
          text,
          source: "scenario",
          name: sender.character.name,
          userName: sender.character.name,
        },
      };

      await receiver.messageManager.createMemory(memory);
    }
  }

  // Send a live message that triggers handlers
  async sendMessage(
    sender: IAgentRuntime,
    receivers: IAgentRuntime[],
    text: string
  ) {
    
    for (const receiver of receivers) {
      const roomData = this.rooms.get(receiver.agentId);
      if (!roomData) continue;
      
      const userId = createUniqueUuid(receiver, sender.agentId);

      if (receiver.agentId !== sender.agentId) {
        // Ensure connection exists
        await receiver.ensureConnection({
          userId,
          roomId: roomData.roomId,
          userName: sender.character.name,
          userScreenName: sender.character.name,
          source: "scenario",
          type: ChannelType.GROUP,
        });
      } else {
        await receiver.ensureConnection({
          userId: sender.agentId,
          roomId: roomData.roomId,
          userName: sender.character.name,
          userScreenName: sender.character.name,
          source: "scenario",
          type: ChannelType.GROUP,
        });
      }

      const memory: Memory = {
        userId: receiver.agentId !== sender.agentId ? userId : sender.agentId,
        agentId: receiver.agentId,
        roomId: roomData.roomId,
        content: {
          text,
          source: "scenario",
          name: sender.character.name,
          userName: sender.character.name,
        },
      };

      receiver.emitEvent("MESSAGE_RECEIVED", {
        runtime: receiver,
        message: memory,
        roomId: roomData.roomId,
        userId: receiver.agentId !== sender.agentId ? userId : sender.agentId,
        source: "scenario",
        type: ChannelType.GROUP,
      });
    }
  }

  // Get conversation history for all participants
  async getConversations(participants: IAgentRuntime[]) {
    const conversations = await Promise.all(
      participants.map(async (member) => {
        const roomData = this.rooms.get(member.agentId);
        if (!roomData) return [];
        return member.messageManager.getMemories({
          roomId: roomData.roomId,
        });
      })
    );

    console.log("\nConversation logs per agent:");
    conversations.forEach((convo, i) => {
      console.log(`\n${participants[i].character.name}'s perspective:`);
      convo.forEach((msg) =>
        console.log(`${msg.content.name}: ${msg.content.text}`)
      );
    });

    return conversations;
  }
}

// Updated scenario implementation using the new client
const scenarios = [
  async function scenario1(members: IAgentRuntime[]) {
    // Create and register test client
    const client = new ScenarioClient();
    await client.start(members[0]);
    members[0].registerClient("scenario", client);

    // Create rooms for all members
    for (const member of members) {
      await client.createRoom(
        member.agentId,
        `Test Room for ${member.character.name}`
      );
    }

    // Set up conversation history
    await client.saveMessage(
      members[0],
      members,
      "Earlier message from conversation..."
    );
    // await client.saveMessage(
    //   members[1],
    //   members,
    //   "Previous reply in history..."
    // );

    // // Send live message that triggers handlers
    // await client.sendMessage(members[0], members, "Hello everyone!");

    // // Get and display conversation logs
    // // wait 5 seconds
    // await new Promise((resolve) => setTimeout(resolve, 5000));
    // await client.getConversations(members);

    // Send a message to all members
    //   await client.sendMessage(members[0], members, "Hello everyone!");
  },
];

export async function startScenario(members: IAgentRuntime[]) {
  for (const scenario of scenarios) {
    await scenario(members);
  }
}
