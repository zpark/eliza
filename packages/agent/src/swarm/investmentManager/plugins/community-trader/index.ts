import type { Plugin } from "@elizaos/core";
import { getAgentPositions } from "./recommendations/agentPositions";
import { getTokenDetails } from "./recommendations/analysis";
import { confirmRecommendation } from "./recommendations/confirm";
import { recommendationEvaluator } from "./recommendations/evaluator";
import { getPositions } from "./recommendations/positions";
import { getRecommenderReport } from "./recommendations/report";
import { getSimulatedPositions } from "./recommendations/simulatedPositions";
import { TrustTradingService } from "./tradingService";

export const communityTraderPlugin: Plugin = {
    name: "community-trader",
    description: "Community Trader Plugin for Eliza",
    evaluators: [recommendationEvaluator],
    providers: [],
    actions: [
        confirmRecommendation,
        getTokenDetails,
        getRecommenderReport,
        getPositions,
        getAgentPositions,
        getSimulatedPositions,
    ],
    services: [TrustTradingService],
};
