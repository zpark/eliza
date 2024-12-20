import { Evaluator, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { NFTKnowledge } from "../types";

export const nftKnowledgeEvaluator: Evaluator = {
    name: "nft-collection-evaluator",
    description: "Evaluates NFT-related content in messages",
    similes: ["nft-evaluator", "nft-knowledge"],
    alwaysRun: false,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content.text.toLowerCase();
        return content.includes("nft") || content.includes("collection");
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const content = message.content.text.toLowerCase();

        // Extract relevant NFT information
        const extractedInfo: NFTKnowledge = {
            mentionsCollection:
                content.includes("collection") || content.includes("nft"),
            mentionsFloorPrice:
                content.includes("floor price") || content.includes("floor"),
            mentionsVolume:
                content.includes("volume") ||
                content.includes("trading volume"),
            mentionsRarity:
                content.includes("rare") || content.includes("rarity"),
        };

        // Update state with extracted information
        return {
            ...state,
            nftKnowledge: extractedInfo,
        };
    },
    examples: [
        {
            context: "Evaluating NFT-related content in messages",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "Tell me about NFT collections" },
                },
                {
                    user: "{{user2}}",
                    content: {
                        text: "I'll help you understand NFT collections.",
                    },
                },
            ],
            outcome:
                "The message contains NFT-related content and should be evaluated.",
        },
    ],
};
