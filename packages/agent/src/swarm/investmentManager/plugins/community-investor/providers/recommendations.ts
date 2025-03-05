import type { Provider } from "@elizaos/core";
import { formatRecommendations } from "../recommendations/evaluator";
import { render } from "../utils";

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
        ));

        const newUserRecommendation = recentRecommendations.filter(
            (m) =>
                m.userId === message.userId &&
                m.content.recommendation.confirmed !== true
        );

        if (newUserRecommendation.length === 0) {
            return {
                data: {
                    recommendations: [],
                },
                values: {
                    hasRecommendations: "false",
                },
                text: "",
            };
        }

        const formattedRecommendations = formatRecommendations(newUserRecommendation);
        const renderedText = render(recommendationsPrompt, {
            recommendations: formattedRecommendations,
        });

        return {
            data: {
                recommendations: newUserRecommendation,
                formattedRecommendations,
            },
            values: {
                hasRecommendations: "true",
                count: newUserRecommendation.length.toString(),
            },
            text: renderedText,
        };
    },
};
