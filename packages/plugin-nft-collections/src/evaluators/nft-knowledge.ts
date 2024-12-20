import { Evaluator, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { NFTKnowledge } from "../types";

export const nftKnowledgeEvaluator: Evaluator = {
    name: "nft-collection-evaluator",
    description: "Evaluates NFT-related content in messages",
    similes: ["nft-evaluator", "nft-knowledge", "market-analysis"],
    alwaysRun: false,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content.text.toLowerCase();
        return (
            content.includes("nft") ||
            content.includes("collection") ||
            content.includes("market") ||
            content.includes("trading")
        );
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const content = message.content.text.toLowerCase();

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
            mentionsMarketTrends:
                content.includes("trend") ||
                content.includes("market") ||
                content.includes("movement"),
            mentionsTraders:
                content.includes("trader") ||
                content.includes("whale") ||
                content.includes("investor"),
            mentionsSentiment:
                content.includes("bull") ||
                content.includes("bear") ||
                content.includes("sentiment") ||
                content.includes("mood"),
            mentionsMarketCap:
                content.includes("market cap") ||
                content.includes("marketcap") ||
                content.includes("valuation"),
        };

        return {
            ...state,
            nftKnowledge: extractedInfo,
        };
    },
    examples: [
        {
            context: "Evaluating NFT market trends",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "How's the NFT market sentiment today?" },
                },
                {
                    user: "{{user2}}",
                    content: {
                        text: "Let me check the market trends and whale activity.",
                    },
                },
            ],
            outcome:
                "The message contains market-related content and should be evaluated.",
        },
    ],
};
