import { Plugin, IAgentRuntime } from "@ai16z/eliza";
import { getCollectionsAction } from "./actions/get-collections";
import { sweepFloorAction } from "./actions/sweep-floor";
import { nftKnowledgeEvaluator } from "./evaluators/nft-knowledge";
import { nftCollectionProvider } from "./providers/nft-collections";
import { ReservoirService } from "./services/reservoir";

interface NFTPlugin extends Plugin {
    setup?: (runtime: IAgentRuntime) => void;
}

const nftCollectionPlugin: NFTPlugin = {
    name: "nft-collection-plugin",
    description:
        "Provides information about NFT collections using Reservoir API",
    actions: [getCollectionsAction, sweepFloorAction],
    providers: [nftCollectionProvider],
    evaluators: [nftKnowledgeEvaluator],
    setup: (runtime) => {
        const apiKey = runtime.character.settings?.secrets?.RESERVOIR_API_KEY;
        if (!apiKey) {
            throw new Error(
                "RESERVOIR_API_KEY is required for the NFT collections plugin"
            );
        }

        const service = new ReservoirService(apiKey);
        (runtime.services as any).set("nft", service);
    },
};

export default nftCollectionPlugin;
export * from "./types";
