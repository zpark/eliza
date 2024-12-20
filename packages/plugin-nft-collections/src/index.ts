import { Plugin } from "@ai16z/eliza";
import { getCollectionsAction } from "./actions/get-collections";
import { sweepFloorAction } from "./actions/sweep-floor";
import { nftKnowledgeEvaluator } from "./evaluators/nft-knowledge";
import { nftCollectionProvider } from "./providers/nft-collections";

const nftCollectionPlugin: Plugin = {
    name: "nft-collection-plugin",
    description:
        "Provides information about curated NFT collections on Ethereum",
    actions: [getCollectionsAction, sweepFloorAction],
    providers: [nftCollectionProvider],
    evaluators: [nftKnowledgeEvaluator],
};

export default nftCollectionPlugin;
export * from "./types";
