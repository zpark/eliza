import {
    composeContext,
    MemoryManager,
    IAgentRuntime,
    Memory,
    ModelClass,
    Evaluator,
    State,
    HandlerCallback,
    UUID,
    formatEvaluatorExamples,
    generateText,
    ServiceType,
} from "@elizaos/core";
import { v4 as uuid } from "uuid";
import { examples } from "./examples.js";
import { recommendationSchema } from "./schema.js";
import recommendationTemplate from "../prompts/recommendations-extract.md";
import recommendationConfirmTemplate from "../prompts/recommendations-confirm.md";
import sentimentTemplate from "../prompts/evaluator-sentiment-analysis.md";
import { z } from "zod";
import { TrustTradingService } from "../tradingService.js";
import {
    extractXMLFromResponse,
    getZodJsonSchema,
    parseConfirmationResponse,
    parseRecommendationsResponse,
    parseSignalResponse,
    render,
} from "../utils.js";
import { RecommendationMemory } from "../types.js";
import recommendationFormatTemplate from "../prompts/recommendation-format.md";

const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

export const formatRecommendations = (recommendations: Memory[]) => {
    return recommendations
        .reverse()
        .map((rec: Memory) => `${JSON.stringify(rec.content.recommendation)}`)
        .join("\n");
};

export const recommendationEvaluator: Evaluator = {
    name: "TRUST_EXTRACT_RECOMMENDATIONS",
    similes: [],
    alwaysRun: true,
    validate: async (
        runtime: IAgentRuntime,
        message: Memory
    ): Promise<boolean> => {
        console.log(
            "validating message for recommendation",
            message.content.text.length < 5
                ? false
                : message.userId !== message.agentId
        );

        if (message.content.text.length < 5) {
            return false;
        }

        return message.userId !== message.agentId;
    },
    description:
        "Extract recommendations to buy or sell memecoins/tokens from the conversation, including details like ticker, contract address, conviction level, and recommender username.",
    async handler(runtime, message, state, options, callback) {
        try {
            await handler(runtime, message, state, options, callback);
        } catch (error) {
            console.error(error);
            throw error;
        }
    },
    examples,
};

async function handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: any
) {
    console.log("Running the evaluator");
    if (!state) return;

    const { agentId, roomId } = state;

    if (!runtime.services.has(ServiceType.TRADING)) {
        console.log("no trading service");
        return;
    }

    const tradingService = runtime.getService<TrustTradingService>(
        ServiceType.TRADING
    )!;

    if (!tradingService.hasWallet("solana")) {
        console.log("no registered solana wallet in trading service");
        return;
    }

    if (message.userId === message.agentId) return;
    console.log("evaluating recommendations....");

    console.log("message", message.content.text);

    const sentimentContext = composeContext({
        template: sentimentTemplate,
        state: { message: message.content.text } as unknown as State,
    });

    const sentimentText = await generateText({
        runtime,
        context: sentimentContext,
        modelClass: ModelClass.MEDIUM,
    });

    const signal = extractXMLFromResponse(sentimentText, "signal");

    const signalInt = parseSignalResponse(signal);

    console.log("signalInt", signalInt);

    if (signalInt === 2 && callback) {
        const responseMemory: Memory = {
            content: {
                text: "Please provide a token address!",
                inReplyTo: message.metadata?.msgId
                    ? message.metadata.msgId
                    : undefined,
                buttons: [],
            },
            userId: message.userId,
            agentId: message.agentId,
            metadata: {
                ...message.metadata,
            },
            roomId: message.roomId,
            createdAt: Date.now() * 1000,
        };
        await callback(responseMemory);
        return;
    }

    if (signalInt === 3) {
        console.log("signal is 3, skipping not related to tokens at all");
        return;
    }

    if (!runtime.memoryManagers.has("recommendations")) {
        runtime.registerMemoryManager(
            new MemoryManager({
                runtime,
                tableName: "recommendations",
            })
        );
    }

    // Get recent recommendations
    const recommendationsManager = runtime.getMemoryManager("recommendations")!;
    // Get recommendations from trust db by user that sent the message
    const recentRecommendations = (await recommendationsManager.getMemories({
        roomId,
        count: 10,
    })) as RecommendationMemory[];

    // Remove any recommendations older than 10 minutes
    Promise.all(
        await recentRecommendations
            .filter(
                (r) => r.createdAt && Date.now() - r.createdAt > 10 * 60 * 1000
            )
            .map((r) => recommendationsManager.removeMemory(r.id as UUID))
    );

    const context = composeContext({
        state: {
            schema: JSON.stringify(getZodJsonSchema(recommendationSchema)),
            message: JSON.stringify({
                text: message.content.text,
                agentId: message.agentId,
                roomId: message.roomId,
                username: message.metadata?.clientUsername,
            }),
        } as unknown as State,
        template: recommendationTemplate,
    });

    // Only function slowing us down: generateText
    const [text, participants] = await Promise.all([
        generateText({
            runtime,
            context: context,
            modelClass: ModelClass.LARGE,
            stopSequences: [],
        }),
        runtime.databaseAdapter.getParticipantsForRoom(message.roomId),
    ]);

    console.log("Participants", participants);

    const newRecommendationsBlock = extractXMLFromResponse(
        text,
        "new_recommendations"
    );

    const parsedRecommendations = parseRecommendationsResponse(
        newRecommendationsBlock
    );

    if (parsedRecommendations.length === 0) {
        console.log("no recommendations found");
        return;
    }

    const recommendationDataMap = parsedRecommendations
        .map((r) => r.recommendation_data)
        .filter((c) => c.conviction !== "null" && c.type !== "null");

    const recommendations = z
        .array(recommendationSchema)
        .parse(recommendationDataMap);

    const tokenRecommendationsSet = new Set(
        recentRecommendations
            .filter((r) => r.content.recommendation.confirmed)
            .map((r) => r.content.recommendation.tokenAddress)
    );

    const filteredRecommendations = recommendations
        .filter((rec) => rec.username !== state.agentName)
        .filter((rec) => !tokenRecommendationsSet.has(rec.tokenAddress));

    if (filteredRecommendations.length === 0) {
        console.log("no new recommendations found");
        return;
    }

    // TODO: getAccounts in database
    const users = await Promise.all(
        participants.map((id) => runtime.databaseAdapter.getEntityById(id))
    ).then((users) => users.filter((user) => !!user));

    // Only Reply to first recommendation
    let hasAgentRepliedTo = false;

    for (const recommendation of filteredRecommendations) {
        if (
            recommendation.tokenAddress !== "null" &&
            recommendation.ticker !== "null" &&
            recommendation.ticker
        ) {
            let tokenAddress = await tradingService.resolveTicker(
                "solana", // todo: extract from recommendation?
                recommendation.ticker
            );

            recommendation.tokenAddress = tokenAddress ?? undefined;
        }

        if (!recommendation.tokenAddress) continue;

        const token = await tradingService.tokenProvider.getTokenOverview(
            "solana",
            recommendation.tokenAddress!
        );

        recommendation.ticker = token.symbol;

        console.log("users", users);

        // find the first user Id from a user with the username that we extracted
        const user = users.find((user) => {
            return (
                user.name.toLowerCase().trim() ===
                    recommendation.username.toLowerCase().trim() ||
                user.id === message.userId
            );
        });

        if (!user) {
            console.warn("Could not find user: ", recommendation.username);
            continue;
        }

        if (TELEGRAM_CHANNEL_ID) {
            (async () => {
                const context = composeContext({
                    state: {
                        recommendation: JSON.stringify(recommendation),
                        recipientAgentName: "scarletAgent",
                    } as unknown as State,
                    template: recommendationFormatTemplate,
                });

                const text = await generateText({
                    runtime,
                    context: context,
                    modelClass: ModelClass.SMALL,
                    stopSequences: [],
                });

                const extractedXML = extractXMLFromResponse(text, "message");

                const formattedResponse =
                    parseConfirmationResponse(extractedXML);

                console.log(formattedResponse);

                if (callback) {
                    const responseMemory: Memory = {
                        content: {
                            text: formattedResponse,
                            buttons: [],
                            channelId: TELEGRAM_CHANNEL_ID,
                        },
                        userId: message.userId,
                        agentId: message.agentId,
                        roomId: message.roomId,
                        metadata: {
                            ...message.metadata,
                            client: "telegram",
                            action: "TRUST_CONFIRM_RECOMMENDATION",
                        },
                        createdAt: Date.now() * 1000,
                    };
                    callback(responseMemory);
                }
            })();
        }

        const recMemory: Memory = {
            id: uuid() as UUID,
            userId: user.id,
            agentId,
            content: { text: "", recommendation },
            roomId,
            createdAt: Date.now(),
        };

        // Store Recommendation
        await Promise.all([
            recommendationsManager.createMemory(recMemory, true),
        ]);

        const tokenString = JSON.stringify(token, (_, v) => {
            if (typeof v === "bigint") return v.toString();
            return v;
        });

        if (callback && !hasAgentRepliedTo) {
            console.log("generating text");
            if (signalInt === 0) {
                const responseMemory: Memory = {
                    content: {
                        text: "Are you just looking for details, or are you recommending this token?",
                        inReplyTo: message.metadata?.msgId
                            ? message.metadata.msgId
                            : undefined,
                        buttons: [],
                    },
                    userId: user.id,
                    agentId: message.agentId,
                    metadata: {
                        ...message.metadata,
                        action: "TRUST_CONFIRM_RECOMMENDATION",
                    },
                    roomId: message.roomId,
                    createdAt: Date.now() * 1000,
                };
                await callback(responseMemory);
                return;
            } else {
                if (
                    recommendation.conviction === "MEDIUM" ||
                    recommendation.conviction === "HIGH"
                ) {
                    // temp message/memory
                    console.log("message", message.metadata);
                    const actionMemory = {
                        id: message.id,
                        userId: user.id,
                        agentId,
                        content: {
                            text: message.content.text,
                            action: "TRUST_CONFIRM_RECOMMENDATION",
                        },
                        roomId,
                        createdAt: Date.now(),
                    };
                    await runtime.processActions(
                        {
                            ...message,
                            ...actionMemory,
                            action: "",
                        } as Memory,
                        [actionMemory as Memory],
                        state,
                        callback
                    );
                    return;
                }
                const context = render(recommendationConfirmTemplate, {
                    agentName: state.agentName!,
                    msg: message.content.text,
                    recommendation: JSON.stringify(recommendation),
                    token: tokenString,
                });

                const res = await generateText({
                    modelClass: ModelClass.MEDIUM,
                    runtime,
                    context: context,
                    stopSequences: [],
                });

                const agentResponseMsg = extractXMLFromResponse(res, "message");
                const question = parseConfirmationResponse(agentResponseMsg);
                const responseMemory: Memory = {
                    content: {
                        text: question,
                        inReplyTo: message.metadata?.msgId
                            ? message.metadata.msgId
                            : undefined,
                        buttons: [],
                    },
                    userId: user.id,
                    agentId: message.agentId,
                    roomId: message.roomId,
                    metadata: {
                        ...message.metadata,
                        action: "TRUST_CONFIRM_RECOMMENDATION",
                    },
                    createdAt: Date.now() * 1000,
                };
                await callback(responseMemory);
            }
            hasAgentRepliedTo = true;
        }
    }
    hasAgentRepliedTo = false;

    return recommendations;
}
