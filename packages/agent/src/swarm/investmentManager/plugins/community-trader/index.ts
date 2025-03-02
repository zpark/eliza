import { Plugin } from "@elizaos/core";
import { trustProvider } from "./provider";
import { getAgentPositions } from "./recommendations/agentPositions";
import { getTokenDetails } from "./recommendations/analysis";
import { confirmRecommendation } from "./recommendations/confirm";
import { recommendationEvaluator } from "./recommendations/evaluator";
import { getPositions } from "./recommendations/positions";
import { getRecommenderReport } from "./recommendations/report";
import { getSimulatedPositions } from "./recommendations/simulatedPositions";

export const communityTraderPlugin: Plugin = {
    name: "community-trader",
    description: "Community Trader Plugin for Eliza",
    evaluators: [recommendationEvaluator],
    providers: [trustProvider],
    actions: [
        confirmRecommendation,
        getTokenDetails,
        getRecommenderReport,
        getPositions,
        getAgentPositions,
        getSimulatedPositions,
    ],
};
