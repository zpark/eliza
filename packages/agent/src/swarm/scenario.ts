import { 
    ChannelType, 
    IAgentRuntime, 
    Memory, 
    UUID, 
    stringToUuid 
  } from "@elizaos/core";
  import { v4 as uuidv4 } from 'uuid';
  
  /**
   * Send a message from one agent to others in a conversation
   */
  async function sayMessage(
    participant: IAgentRuntime,
    roomMap: Map<string, UUID>,
    members: IAgentRuntime[],
    message: string
  ) {
    const participantId = participant.agentId;
    const serverId = `test-server-${uuidv4()}`; // Unique server ID per conversation
  
    // For each receiving participant, create memory and emit event
    for (const receiver of members) {  
      const roomId = roomMap.get(receiver.agentId);
      if (!roomId) continue;
  
      if (receiver.agentId !== participantId){
        // Ensure connection exists
        await receiver.ensureConnection({
            userId: participantId,
            roomId,
            userName: participant.character.name,
            userScreenName: participant.character.name,
            source: "scenario",
            type: ChannelType.GROUP,
            serverId: serverId,
            channelId: roomId
        });
        }
  
      // Create memory of message
      const memory: Memory = {
        id: stringToUuid(`msg-${Date.now()}`),
        userId: participantId,
        agentId: receiver.agentId,
        roomId,
        content: {
          text: message,
          source: "scenario",
          name: participant.character.name,
          userName: participant.character.name
        },
        createdAt: Date.now()
      };
  
      await receiver.messageManager.createMemory(memory);
  
      // Emit message received event
      receiver.emitEvent("MESSAGE_RECEIVED", {
        runtime: receiver,
        message: memory,
        roomId,
        userId: participantId,
        serverId: serverId,
        source: "scenario",
        type: ChannelType.GROUP
      });
    }
  
    // Log message for debugging
    console.log(`${participant.character.name}: ${message}`);
  }
  
  // Collection of test scenarios
  const scenarios = [
    // Basic conversation scenario 
    async function scenario1(members: IAgentRuntime[]) {
      // Create unique room for each agent's perspective
      const roomMap = new Map<string, UUID>();
      const serverId = `test-server-${uuidv4()}`;
  
      for (const member of members) {
        const roomId = stringToUuid(`room-${uuidv4()}`);
        roomMap.set(member.agentId, roomId);
  
        // Initialize room for this agent
        await member.ensureRoomExists({
          id: roomId,
          name: `Test Room for ${member.character.name}`,
          source: "scenario",
          type: ChannelType.GROUP,
          channelId: roomId,
          serverId: serverId
        });
      }
  
      // Run the conversation
      await sayMessage(members[0], roomMap, members, "Hello everyone!");
    //   await sayMessage(members[1], roomMap, members, "Hi there, how can we help?");
    //   await sayMessage(members[2], roomMap, members, "I can assist with any questions.");
  
      console.log(roomMap);
      // Get conversation history for each agent
      const conversations = await Promise.all(members.map(async (member) => {
        return member.messageManager.getMemories({
          roomId: roomMap.get(member.agentId),
        });
      }));
  
      // Log results
      console.log("\nConversation logs per agent:");
      conversations.forEach((convo, i) => {
        console.log(`\n${members[i].character.name}'s perspective:`);
        convo.forEach(msg => console.log(`${msg.content.name}: ${msg.content.text}`));
      });
    },
  
    // New user onboarding scenario
    // async function newUserScenario(members: IAgentRuntime[]) {
    //   const roomMap = new Map<string, UUID>();
    //   const serverId = `test-server-${uuidv4()}`;
  
    //   // Set up rooms
    //   for (const member of members) {
    //     const roomId = stringToUuid(`room-${uuidv4()}`);
    //     roomMap.set(member.agentId, roomId);
  
    //     await member.ensureRoomExists({
    //       id: roomId,
    //       name: `Onboarding Room for ${member.character.name}`,
    //       source: "scenario",
    //       type: ChannelType.GROUP,
    //       channelId: roomId,
    //       serverId: serverId
    //     });
    //   }
  
    //   // Run onboarding conversation
    //   await sayMessage(members[0], roomMap, members, "NewUser joined the server");
    //   await sayMessage(members[1], roomMap, members, "Hi everyone! I'm new here!");
    //   await sayMessage(members[2], roomMap, members, "Welcome! How can we help you get started?");
  
    //   // Get conversation logs
    //   const conversations = await Promise.all(members.map(async (member) => {
    //     return member.messageManager.getMemories({
    //       roomId: roomMap.get(member.agentId),
    //     });
    //   }));
  
    //   console.log("\nOnboarding scenario logs:");
    //   conversations.forEach((convo, i) => {
    //     console.log(`\n${members[i].character.name}'s perspective:`);
    //     convo.forEach(msg => console.log(`${msg.content.name}: ${msg.content.text}`));
    //   });
    // }
  ];
  
  /**
   * Main entry point for running scenarios
   */
  export async function startScenario(members: IAgentRuntime[]) {
    for (const scenario of scenarios) {
      await scenario(members);
    }
  }