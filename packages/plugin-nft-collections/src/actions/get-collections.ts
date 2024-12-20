import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import { nftCollectionProvider } from "../providers/nft-collections";

export const getCollectionsAction: Action = {
    name: "GET_NFT_COLLECTIONS",
    similes: ["LIST_NFT_COLLECTIONS", "SHOW_NFT_COLLECTIONS"],
    description:
        "Fetches information about curated NFT collections on Ethereum",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return message.content.text.toLowerCase().includes("nft collections");
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const response = await nftCollectionProvider.get(runtime, message);
            await runtime.messageManager.createMemory({
                id: message.id,
                content: { text: response },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
            });
            return true;
        } catch (error) {
            console.error("Error fetching NFT collections:", error);
            await runtime.messageManager.createMemory({
                id: message.id,
                content: { text: "Failed to fetch NFT collection data." },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
            });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you tell me about the top NFT collections?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Certainly! Here are the top NFT collections on Ethereum:",
                    action: "GET_NFT_COLLECTIONS",
                },
            },
        ],
    ],
};
