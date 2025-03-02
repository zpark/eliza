import {
    Action,
    Memory,
    logger
} from "@elizaos/core";
import { TrustScoreDatabase } from "../db";
import { formatRecommenderReport } from "../reports";

export const getRecommenderReport: Action = {
    name: "GET_RECOMMENDER_REPORT",
    description: "Gets a recommender's report scoring their recommendations",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "what is my recommender score?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "<NONE>",
                    action: "GET_RECOMMENDER_REPORT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "please provide my recommender report",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "<NONE>",
                    action: "GET_RECOMMENDER_REPORT",
                },
            },
        ],
    ],
    similes: ["RECOMMENDER_REPORT", "RECOMMENDER_SCORE"],

    async handler(runtime, message, state, options, callback: any) {
        if (!callback) {
            logger.error(
                "No callback provided, no recommender score can be generated"
            );
            return;
        }

        const db = new TrustScoreDatabase(trustDb);
        const user = await runtime.databaseAdapter.getEntityById(
            message.userId
        );

        if (!user) {
            logger.error(
                "No User Found, no recommender score can be generated"
            );
            return;
        }

        const recommender = await db.getRecommenderByPlatform(
            // id: message.userId,
            message.content.source ?? "unknown",
            user.id
        );

        const metrics = recommender
            ? await db.getRecommenderMetrics(recommender.id)
            : undefined;

        if (
            !metrics?.trustScore ||
            metrics.trustScore === 0 ||
            metrics.trustScore === -100
        ) {
            const responseMemory: Memory = {
                content: {
                    text: "You don't have a recommender score yet. Please start recommending tokens to earn a score.",
                    inReplyTo: message.metadata?.msgId
                        ? message.metadata.msgId
                        : undefined,
                },
                userId: message.userId,
                agentId: message.agentId,
                roomId: message.roomId,
                metadata: {
                    ...message.metadata,
                    action: "GET_RECOMMENDER_REPORT",
                },
                createdAt: Date.now() * 1000,
            };
            await callback(responseMemory);
            return true;
        }

        logger.info(
            `Recommender report for ${recommender?.id}: ${metrics?.trustScore}`
        );
        const recommenderReport =
            recommender && metrics
                ? formatRecommenderReport(
                      recommender,
                      metrics,
                      await db.getRecommenderMetricsHistory(recommender.id)
                  )
                : "";
        logger.info(`Recommender report: ${recommenderReport}`);
        const responseMemory: Memory = {
            content: {
                text: recommenderReport,
            },
            userId: message.userId,
            agentId: message.agentId,
            roomId: message.roomId,
            metadata: {
                ...message.metadata,
                action: "GET_RECOMMENDER_REPORT",
            },
            createdAt: Date.now() * 1000,
        };
        await callback(responseMemory);
        return true;
    },
    async validate(_, message) {
        if (message.agentId === message.userId) return false;
        return true;
    },
};
