import { ChannelType, type IAgentRuntime, stringToUuid, type UUID } from "@elizaos/core";
import { v4 as uuidv4 } from 'uuid';

// 

const scenarios = [
    async function scenario1(members: IAgentRuntime[]) {
        const participant1 = members[0];
        const participant2 = members[1];

        const roomId = uuidv4() as UUID;

        await participant1.ensureConnection({
            userId: participant1.agentId,
            roomId,
            userName: participant1.character.name,
            userScreenName: participant1.character.name,
            source: "scenario",
            type: ChannelType.GROUP,
        });

        await participant2.ensureConnection({
            userId: participant2.agentId,
            roomId,
            userName: participant2.character.name,
            userScreenName: participant2.character.name,
            source: "scenario",
            type: ChannelType.GROUP,
        });
    },
];

export async function startScenario(members: IAgentRuntime[]) {
    // TODO: Connect to mock messaging protocol
    for (const scenario of scenarios) {
        await scenario(members);
    }

}