import {
    Plugin,
    Action,
    IAgentRuntime,
    Memory,
    State,
    Service,
    Evaluator,
    ServiceType,
} from "@ai16z/eliza";
import { nftCollectionProvider } from "./providers/nft-collections";

interface NFTKnowledge {
    mentionsCollection: boolean;
    mentionsFloorPrice: boolean;
    mentionsVolume: boolean;
    mentionsRarity: boolean;
}

interface INFTMarketplaceService extends Service {
    serviceType: ServiceType;
    getFloorNFTs(collectionAddress: string, quantity: number): Promise<any[]>;
    batchPurchaseNFTs(nfts: any[]): Promise<string[]>;
}

// Helper function to enhance responses based on NFT knowledge
const enhanceResponse = (response: string, state: State) => {
    const nftKnowledge = state.nftKnowledge as NFTKnowledge;

    if (nftKnowledge?.mentionsCollection) {
        response +=
            " Would you like to know more about specific NFT collections?";
    }

    if (nftKnowledge?.mentionsFloorPrice) {
        response +=
            " I can provide information on floor prices for popular collections.";
    }

    if (nftKnowledge?.mentionsVolume) {
        response +=
            " I can share recent trading volume data for NFT collections.";
    }

    if (nftKnowledge?.mentionsRarity) {
        response +=
            " I can explain rarity factors in NFT collections if you're interested.";
    }

    return response;
};

const nftCollectionEvaluator: Evaluator = {
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

// Helper function to extract NFT details from the message
function extractNFTDetails(text: string): {
    collectionAddress: string;
    quantity: number;
} {
    // TODO: Implement proper extraction logic
    return {
        collectionAddress: "0x...", // Extract from text
        quantity: 5, // Extract from text
    };
}

const sweepFloorNFTAction: Action = {
    name: "SWEEP_FLOOR_NFT",
    similes: ["BUY_FLOOR_NFT", "PURCHASE_FLOOR_NFT"],
    description:
        "Sweeps the floor of a specified EVM NFT collection by purchasing the lowest-priced available NFTs.",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content.text.toLowerCase();
        return content.includes("sweep") && content.includes("nft");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Extract collection address and quantity from the message
            const { collectionAddress, quantity } = extractNFTDetails(
                message.content.text
            );

            // Get NFT marketplace service
            const nftService = (runtime.services as any).get(
                "nft_marketplace"
            ) as INFTMarketplaceService;
            if (!nftService) {
                throw new Error("NFT marketplace service not found");
            }

            // Fetch floor NFTs
            const floorNFTs = await nftService.getFloorNFTs(
                collectionAddress,
                quantity
            );

            // Purchase floor NFTs
            const transactions = await nftService.batchPurchaseNFTs(floorNFTs);

            // Prepare response
            const response = `Successfully swept ${quantity} floor NFTs from collection ${collectionAddress}. Transaction hashes: ${transactions.join(", ")}`;

            // Send response
            await runtime.messageManager.createMemory({
                id: message.id,
                content: { text: response },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
            });

            return true;
        } catch (error) {
            console.error("Floor sweep failed:", error);
            await runtime.messageManager.createMemory({
                id: message.id,
                content: {
                    text: "Failed to sweep floor NFTs. Please try again later.",
                },
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
                    text: "Can you sweep the floor of the Bored Ape Yacht Club NFT collection? I want to buy 5 of the cheapest ones.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Certainly! I'll sweep the floor of the Bored Ape Yacht Club NFT collection and purchase the 5 cheapest NFTs available.",
                    action: "SWEEP_FLOOR_NFT",
                },
            },
        ],
    ],
};

const nftCollectionAction: Action = {
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

const nftCollectionPlugin: Plugin = {
    name: "nft-collection-plugin",
    description:
        "Provides information about curated NFT collections on Ethereum",
    actions: [nftCollectionAction, sweepFloorNFTAction],
    providers: [nftCollectionProvider],
    evaluators: [nftCollectionEvaluator],
};

export default nftCollectionPlugin;
