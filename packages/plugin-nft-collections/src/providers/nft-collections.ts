import { IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { NFTCollection, NFTService } from "../types";

export const nftCollectionProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const nftService = runtime.services.get("nft") as any as NFTService;
            if (!nftService) {
                throw new Error("NFT service not configured");
            }

            const collections = await nftService.getTopCollections({
                limit: 10,
            });
            const formattedCollections = collections
                .map(
                    (collection: NFTCollection) =>
                        `${collection.name}:\n` +
                        `• Floor Price: ${collection.floorPrice} ETH\n` +
                        `• 24h Volume: ${collection.volume24h} ETH\n` +
                        `• Total Supply: ${collection.tokenCount} NFTs\n` +
                        `• Contract: ${collection.address}\n`
                )
                .join("\n");

            return `Here are the top NFT collections:\n\n${formattedCollections}`;
        } catch (error) {
            console.error("Failed to fetch NFT collections:", error);
            return "Sorry, I couldn't fetch the NFT collections at the moment. Please try again later.";
        }
    },
};
