import { State } from "@ai16z/eliza";
import { NFTKnowledge } from "../types";

export function enhanceResponse(response: string, state: State): string {
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
}
