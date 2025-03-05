import {
    type Action,
    type IAgentRuntime,
    logger,
    type Memory,
    type UUID,
    type MemoryMetadata
} from "@elizaos/core";
import { v4 as uuid } from "uuid";
import type { TrustTradingService } from "../tradingService";
import type { MessageRecommendation } from "./schema";
import { RecommendationType, Conviction, ServiceTypes } from "../types";

// Use type intersection for extended metadata
type ExtendedMetadata = MemoryMetadata & {
    clientUsername?: string;
    clientUserId?: string;
    clientChatId?: string;
};

export const confirmRecommendation: Action = {
    name: "TRUST_CONFIRM_RECOMMENDATION",
    description:
        "Confirms <draft_recommendations> to buy or sell memecoins/tokens in <user_recommendations_provider> from the <trust_plugin>",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "do you wish to confirm this recommendation?\n {...recomendation}",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "yes, I would",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "<NONE>",
                    actions: ["TRUST_CONFIRM_RECOMMENDATION"],
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Are you just looking for details, or are you recommending this token?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I am recommending this token",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "<NONE>",
                    actions: ["TRUST_CONFIRM_RECOMMENDATION"],
                },
            },
        ],
    ],
    similes: ["CONFIRM_RECOMMENDATION"],

    async handler(runtime: IAgentRuntime, message, _state, _options, callback: any) {
        console.log("confirmRecommendation is running");
        if (!runtime.getService(ServiceTypes.TRUST_TRADING)) {
            console.log("no trading service");
            return;
        }

        // Emote to signal that the recommendation is being confirmed
        if (callback) {
            console.log(
                "emoting to signal that the recommendation is being confirmed"
            );
            const responseMemory: Memory = {
                content: {
                    text: "Placing recommendation...",
                    reaction: {
                        type: [{ type: "emoji", emoji: "👍" }],
                        onlyReaction: true,
                    },
                    inReplyTo: message.id
                        ? message.id
                        : undefined,
                    actions: ["TRUST_CONFIRM_RECOMMENDATION"],
                },
                userId: message.userId,
                agentId: message.agentId,
                roomId: message.roomId,
                metadata: message.metadata,
                createdAt: Date.now() * 1000,
            };
            await callback(responseMemory);
        }

        const tradingService = runtime.getService<TrustTradingService>(
            ServiceTypes.TRUST_TRADING
        )!;

        if (!tradingService.hasWallet("solana")) {
            console.log("no registered solana wallet in trading service");
            return;
        }
        
        const recommendationsManager =
            runtime.getMemoryManager("recommendations")!;

        const recentRecommendations = await recommendationsManager.getMemories({
            roomId: message.roomId,
            count: 20,
        });

        const newUserRecommendations = recentRecommendations
            .filter((m) => m.userId === message.userId)
            .sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0));

        if (newUserRecommendations.length === 0) return;

        console.log(
            "newUserRecommendations",
            JSON.stringify(newUserRecommendations)
        );

        //     const prompt = composePrompt({
        //         state: {
        //             ...state,
        //             recommendations: formatRecommendations(newUserRecommendations),
        //             message: message.content.text,
        //         },
        //         template: extractConfirmationsTemplate,
        //     });

        //     const text = await generateText({
        //         runtime,
        //         prompt,
        //         modelType: ModelTypes.TEXT_SMALL,
        //         stop: [],
        //     });
        //     const xmlResponse = extractXMLFromResponse(text, "tokens");
        //const tokens = parseTokensResponse(xmlResponse);

        const tokens = [
            //@ts-ignore
            newUserRecommendations[0]?.content?.recommendation?.tokenAddress ??
                "",
        ];

        if (!Array.isArray(tokens) || tokens[0] === "") return;
        logger.info(tokens);

        try {
            const participants =
                await runtime.databaseAdapter.getParticipantsForRoom(
                    message.roomId
                );

            const users = await Promise.all(
                participants.map((id) =>
                    runtime.databaseAdapter.getEntityById(id)
                )
            ).then((users) => users.filter((user) => !!user));

            for (const tokenAddress of [tokens[tokens.length - 1]]) {
                const memory = newUserRecommendations.find(
                    (r) =>
                        (r.content.recommendation as MessageRecommendation)
                            .tokenAddress === tokenAddress
                );

                if (!memory) continue;

                const recommendation = memory.content
                    .recommendation as MessageRecommendation;

                const user = users.find((user) => {
                    return (
                        user.names.map((name) => name.toLowerCase().trim())
                            .includes(recommendation.username.toLowerCase().trim()) ||
                        user.id === message.userId
                    );
                });

                if (!user) {
                    console.warn(
                        "Could not find user: ",
                        recommendation.username
                    );
                    continue;
                }

                const entity = await runtime.databaseAdapter.getEntityById(user.id);

                const result = await tradingService.handleRecommendation(
                    entity,
                    {
                        chain: "solana", // TODO: handle multichain
                        conviction: recommendation.conviction === "HIGH" ? Conviction.HIGH :
                            recommendation.conviction === "MEDIUM" ? Conviction.MEDIUM :
                            Conviction.LOW,
                        tokenAddress: recommendation.tokenAddress!,
                        type: recommendation.type === "BUY" ? RecommendationType.BUY :
                            RecommendationType.SELL,
                        timestamp: message.createdAt
                            ? new Date(message.createdAt)
                            : new Date(),
                        metadata: {
                            msg: message.content.text ?? "CONFIRMATION",
                            msgId: message.id!,
                            chatId: (message.metadata as ExtendedMetadata)?.clientChatId,
                        },
                    }
                );

                const newUUID = uuid() as UUID;

                await Promise.all([
                    recommendationsManager.removeMemory(memory.id!),
                    recommendationsManager.createMemory({
                        id: newUUID,
                        userId: user.id,
                        agentId: message.agentId,
                        roomId: message.roomId,
                        content: {
                            text: "",
                            recommendation: {
                                ...recommendation,
                                confirmed: true,
                            },
                        },
                    }),
                ]);

                if (callback && result) {
                    switch (recommendation.type) {
                        case "BUY": {
                            const responseMemory: Memory = {
                                id: newUUID,
                                content: {
                                    text: `Simulation buy started for token: ${recommendation.ticker} (${recommendation.tokenAddress})`,
                                    inReplyTo: message.id
                                        ? message.id
                                        : undefined,
                                    actions: ["TRUST_CONFIRM_RECOMMENDATION"],
                                },
                                userId: user.id,
                                agentId: message.agentId,
                                roomId: message.roomId,
                                metadata: message.metadata,
                                createdAt: Date.now() * 1000,
                            };
                            await callback(responseMemory);
                            break;
                        }
                        case "DONT_BUY":
                        case "SELL":
                        case "DONT_SELL":
                            break;
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    },

    async validate(_runtime, message) {
        if (message.agentId === message.userId) return false;
        return true;
    },
};
