
import { MemoryManager } from "../memory.ts";
import { formatMessages } from "../prompts.ts";
import { type IAgentRuntime, type Memory, ModelTypes, type Provider, type State } from "../types.ts";

function formatFacts(facts: Memory[]) {
    return facts
        .reverse()
        .map((fact: Memory) => fact.content.text)
        .join("\n");
}

const factsProvider: Provider = {
    name: "FACTS",
    description: "Key facts that {{agentName}} knows",
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const recentMessagesData = state?.values?.recentMessagesData?.slice(-10);

        const recentMessages = formatMessages({
            messages: recentMessagesData,
            entities: state?.entitiesData,
        });

        const embedding = await runtime.useModel(ModelTypes.TEXT_EMBEDDING, recentMessages);

        const memoryManager = new MemoryManager({
            runtime,
            tableName: "facts",
        });

        const [relevantFacts, recentFactsData] = await Promise.all([
          memoryManager.searchMemories({
              embedding,
              roomId: message.roomId,
              count: 10,
              agentId: runtime.agentId,
          }),
          memoryManager.getMemories({
            roomId: message.roomId,
            count: 10,
            start: 0,
            end: Date.now(),
          })
        ])

        // join the two and deduplicate
        const allFacts = [...relevantFacts, ...recentFactsData].filter(
            (fact, index, self) =>
                index === self.findIndex((t) => t.id === fact.id)
        );

        if (allFacts.length === 0) {
            return {
                values: {
                    facts: "",
                },
                data: {
                    facts: allFacts,
                },
                text: "",
            };
        }

        const formattedFacts = formatFacts(allFacts);

        const text = "Key facts that {{agentName}} knows:\n{{formattedFacts}}"
            .replace("{{agentName}}", runtime.character.name)
            .replace("{{formattedFacts}}", formattedFacts);

        return {
            values: {
                facts: formattedFacts,
            },
            data: {
                facts: allFacts,
            },
            text,
        };
    },
};

export { factsProvider };
