import {
    Plugin,
    Action,
    Provider,
    IAgentRuntime,
    Memory,
    State,
} from "@ai16z/eliza";
import axios from "axios";

interface NFTCollection {
    name: string;
    totalSupply: number;
    floorPrice: number;
    volume24h: number;
}

const fetchNFTCollections = async (): Promise<NFTCollection[]> => {
    const API_KEY = process.env.RESERVOIR_API_KEY;
    const response = await axios.get(
        "https://api.reservoir.tools/collections/v6",
        {
            headers: {
                accept: "application/json",
                "x-api-key": API_KEY,
            },
        }
    );
    return response.data.collections.map((collection: any) => ({
        name: collection.name,
        totalSupply: collection.totalSupply,
        floorPrice: collection.floorAsk.price.amount.native,
        volume24h: collection.volume["1day"],
    }));
};

const nftCollectionAction: Action = {
    name: "GET_NFT_COLLECTIONS",
    description:
        "Fetches information about curated NFT collections on Ethereum",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return message.content.text.toLowerCase().includes("nft collections");
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const collections = await fetchNFTCollections();
            const response = collections
                .map(
                    (c) =>
                        `${c.name}: Supply: ${c.totalSupply}, Floor: ${c.floorPrice.toFixed(2)} ETH, 24h Volume: ${c.volume24h.toFixed(2)} ETH`
                )
                .join("\n");
            await runtime.sendMessage(message.roomId, response);
            return true;
        } catch (error) {
            console.error("Error fetching NFT collections:", error);
            await runtime.sendMessage(
                message.roomId,
                "Failed to fetch NFT collection data."
            );
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

const nftCollectionProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const collections = await fetchNFTCollections();
            return `Current top NFT collections on Ethereum:\n${collections
                .map(
                    (c) =>
                        `${c.name}: Supply: ${c.totalSupply}, Floor: ${c.floorPrice.toFixed(2)} ETH, 24h Volume: ${c.volume24h.toFixed(2)} ETH`
                )
                .join("\n")}`;
        } catch (error) {
            console.error("Error in NFT collection provider:", error);
            return "Unable to fetch NFT collection data at the moment.";
        }
    },
};

const nftCollectionPlugin: Plugin = {
    name: "nft-collection-plugin",
    description:
        "Provides information about curated NFT collections on Ethereum",
    actions: [nftCollectionAction],
    providers: [nftCollectionProvider],
};

export default nftCollectionPlugin;
