import { IAgentRuntime, Memory, Provider } from "@ai16z/eliza";

export const nftCollectionProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        // TODO: Implement NFT collection data fetching
        return "Here are the top NFT collections...";
    },
};
