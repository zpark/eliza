import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { NFTService } from "../types";

// Helper function to extract NFT listing details from the message
function extractListingDetails(text: string): {
    tokenId: string | null;
    collectionAddress: string | null;
    price?: number | null;
} {
    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const tokenIdMatch = text.match(/token(?:Id)?\s*#?\s*(\d+)/i);
    const priceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:eth|Ξ)/i);

    return {
        collectionAddress: addressMatch ? addressMatch[0] : null,
        tokenId: tokenIdMatch ? tokenIdMatch[1] : null,
        price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
    };
}

export const listNFTAction: Action = {
    name: "LIST_NFT",
    similes: ["SELL_NFT", "CREATE_LISTING"],
    description:
        "Lists an NFT for sale on ikigailabs.xyz marketplace at double the purchase price.",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content.text.toLowerCase();
        return (
            (content.includes("list") || content.includes("sell")) &&
            content.includes("nft") &&
            (content.includes("0x") ||
                content.includes("token") ||
                content.includes("#"))
        );
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const {
                collectionAddress,
                tokenId,
                price: userSpecifiedPrice,
            } = extractListingDetails(message.content.text);

            if (!collectionAddress || !tokenId) {
                throw new Error(
                    "Please provide the collection address and token ID"
                );
            }

            const nftService = runtime.services.get(
                "nft" as any
            ) as unknown as NFTService;
            if (!nftService) {
                throw new Error("NFT service not found");
            }

            // Verify ownership before listing
            const ownedNFTs = await nftService.getOwnedNFTs(message.userId);
            const ownedNFT = ownedNFTs.find(
                (nft) =>
                    nft.collectionAddress.toLowerCase() ===
                        collectionAddress.toLowerCase() &&
                    nft.tokenId === tokenId
            );

            if (!ownedNFT) {
                throw new Error("You don't own this NFT");
            }

            // Get purchase history to determine the purchase price
            const activity =
                await nftService.getCollectionActivity(collectionAddress);
            const purchaseTransaction = activity.activities?.find(
                (act: any) =>
                    act.type === "sale" &&
                    act.toAddress?.toLowerCase() ===
                        message.userId.toLowerCase() &&
                    act.token?.tokenId === tokenId
            );

            if (!purchaseTransaction) {
                throw new Error(
                    "Could not find purchase history for this NFT. Please specify a listing price."
                );
            }

            // Calculate listing price (double the purchase price)
            const purchasePrice = purchaseTransaction.price?.amount?.native;
            if (!purchasePrice) {
                throw new Error(
                    "Could not determine purchase price. Please specify a listing price."
                );
            }

            const listingPrice = userSpecifiedPrice || purchasePrice * 2;

            // Create the listing on ikigailabs
            const listing = await nftService.createListing({
                tokenId,
                collectionAddress,
                price: listingPrice,
                marketplace: "ikigailabs",
                expirationTime:
                    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
            });

            const response =
                `Successfully created listing on ikigailabs.xyz:\n` +
                `• Collection: ${collectionAddress}\n` +
                `• Token ID: ${tokenId}\n` +
                `• Purchase Price: ${purchasePrice} ETH\n` +
                `• Listing Price: ${listingPrice} ETH (${userSpecifiedPrice ? "user specified" : "2x purchase price"})\n` +
                `• Status: ${listing.status}\n` +
                `• Listing URL: ${listing.marketplaceUrl}\n` +
                (listing.transactionHash
                    ? `• Transaction: ${listing.transactionHash}\n`
                    : "");

            await runtime.messageManager.createMemory({
                id: message.id,
                content: { text: response },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
            });

            return true;
        } catch (error) {
            console.error("NFT listing failed:", error);
            await runtime.messageManager.createMemory({
                id: message.id,
                content: {
                    text: `Failed to list NFT: ${error.message}`,
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
                    text: "List token #123 from collection 0x1234...abcd",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating listing on ikigailabs.xyz at 2x purchase price...",
                    action: "LIST_NFT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "List token #123 from collection 0x1234...abcd for 5 ETH",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating listing on ikigailabs.xyz with specified price...",
                    action: "LIST_NFT",
                },
            },
        ],
    ],
};
