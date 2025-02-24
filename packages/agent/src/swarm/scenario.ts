import { ChannelType, type IAgentRuntime, Memory, stringToUuid, type UUID } from "@elizaos/core";
import { v4 as uuidv4 } from 'uuid';

async function sayMessage(participant: IAgentRuntime, roomMap, participants: IAgentRuntime[], message: string) {
    const participantId = participant.agentId;

    // for each participant, create the memory
    for (const participant of [participants[0]]) {
        console.log("participant");
        console.log(participant.agentId, participantId);
        if(participant.agentId === participantId) {
            continue;
        }

        const roomId = roomMap.get(participant.agentId);
        await participant.ensureConnection({
            userId: participantId,
            roomId,
            userName: participant.character.name,
            userScreenName: participant.character.name,
            source: "scenario",
            type: ChannelType.GROUP,
        });
        const memoryManager = participant.messageManager;
        const memory: Memory = {
            userId: participantId,
            agentId: participant.agentId,
            roomId,
            content: {
                text: message,
            }
        }
        await memoryManager.createMemory(memory);

        // participant.emitEvent("MESSAGE_RECEIVED", {
        //     runtime: participant,
        //     message: memory,
        //     roomId: roomId,
        //     userId: participantId,
        //     serverId: roomId,
        //     channelId: roomId,
        //     source: "scenario",
        //     type: ChannelType.GROUP,
        // });
    }
}

const scenarios = [
    async function scenario1(members: IAgentRuntime[]) {
        // create a map of member agentId to room UUID
        const roomMap = new Map<string, UUID>();
        for (const member of members) {
            const roomId = uuidv4() as UUID;
            roomMap.set(member.agentId, roomId);
        }

        await sayMessage(members[0], roomMap, members, "Hello bob!");
        await sayMessage(members[1], roomMap, members, "Hello alice!");
        await sayMessage(members[0], roomMap, members, "Hello bob again!");
        await sayMessage(members[1], roomMap, members, "Hello alice again!");
        await sayMessage(members[2], roomMap, members, "I'm charlie!");
        await sayMessage(members[0], roomMap, members, "Hello bob, how are you?");
        await sayMessage(members[1], roomMap, members, "Hello alice, I'm good!");
        await sayMessage(members[2], roomMap, members, "I'm good too!");

        const conversations = await Promise.all(members.map(async (member) => {
            return member.messageManager.getMemories({
                roomId: roomMap.get(member.agentId),
            });
        }));
        console.log(conversations);
    },
];

export async function startScenario(members: IAgentRuntime[]) {
    // TODO: Connect to mock messaging protocol
    for (const scenario of scenarios) {
        await scenario(members);
    }

}