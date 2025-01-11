import { Plugin } from "@ai16z/eliza";
import { NFTCollectionsService } from "./services/nft-collections";

export function createNFTCollectionsPlugin() {
    return {
        name: "nft-collections",
        description:
            "Provides NFT collection information and market intelligence",
        services: [new NFTCollectionsService()],
    } as const satisfies Plugin;
}
