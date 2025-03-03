import type { Provider } from "@elizaos/core";
import { formatRecommendations } from "../recommendations/evaluator";
import { render } from "../utils";
import type { RecommendationMemory } from "../types";

const recommendationsPrompt = `<user_recommendations_provider>
<draft_recommendations>{{recommendations}}</draft_recommendations>
</user_recommendations_provider>` as const;

export const recommendationsProvider: Provider = {
    name: "recommendations",
    async get(runtime, message) {
        const recommendationsManager =
            runtime.getMemoryManager("recommendations")!;

        const recentRecommendations = (await recommendationsManager.getMemories(
            {
                roomId: message.roomId,
                count: 5,
            }
        )) as RecommendationMemory[];

        const newUserRecommendation = recentRecommendations.filter(
            (m) =>
                m.userId === message.userId &&
                m.content.recommendation.confirmed !== true
        );

        if (newUserRecommendation.length === 0) return "";

        return render(recommendationsPrompt, {
            recommendations: formatRecommendations(newUserRecommendation),
        });
    },
};
