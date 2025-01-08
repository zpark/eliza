import {
    composeContext,
    elizaLogger,
    generateMessageResponse,
    generateText,
    IAgentRuntime,
    ModelClass,
    ServiceType,
    State,
    stringToUuid,
} from "@ai16z/eliza";
import { buildConversationThread, sendJeet, wait } from "./utils";
import {
    EnhancedResponseContent,
    Jeet,
    JeetInteraction,
    JeetResponse,
} from "./types";
import { ClientBase } from "./base";
import {
    JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER,
    JEETER_SEARCH_BASE,
} from "./constants";

const jeeterSearchTemplate =
    JEETER_SEARCH_BASE + JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER;

export class JeeterSearchClient {
    private repliedJeets: Set<string> = new Set();
    private likedJeets: Set<string> = new Set();
    private rejeetedJeets: Set<string> = new Set();
    private quotedJeets: Set<string> = new Set();

    constructor(
        private client: ClientBase,
        private runtime: IAgentRuntime
    ) {}

    private async hasInteracted(
        jeetId: string,
        type: JeetInteraction["type"]
    ): Promise<boolean> {
        switch (type) {
            case "reply":
                return this.repliedJeets.has(jeetId);
            case "like":
                return this.likedJeets.has(jeetId);
            case "rejeet":
                return this.rejeetedJeets.has(jeetId);
            case "quote":
                return this.quotedJeets.has(jeetId);
            default:
                return false;
        }
    }

    private recordInteraction(jeetId: string, type: JeetInteraction["type"]) {
        switch (type) {
            case "reply":
                this.repliedJeets.add(jeetId);
                break;
            case "like":
                this.likedJeets.add(jeetId);
                break;
            case "rejeet":
                this.rejeetedJeets.add(jeetId);
                break;
            case "quote":
                this.quotedJeets.add(jeetId);
                break;
        }
    }

    async start() {
        let isRunning = false;
        const handleJeeterInteractionsLoop = async () => {
            if (isRunning) {
                elizaLogger.log("Previous engagement still running, skipping");
                return;
            }

            try {
                isRunning = true;
                await this.engageWithSearchTerms();
            } catch (error) {
                elizaLogger.error("Error in engagement loop:", error);
            } finally {
                isRunning = false;
            }

            setTimeout(
                handleJeeterInteractionsLoop,
                (Math.floor(Math.random() * (120 - 60 + 1)) + 60) * 60 * 1000
            );
        };
        handleJeeterInteractionsLoop();
    }

    private async engageWithSearchTerms() {
        elizaLogger.log("Engaging with search terms");
        try {
            if (!this.runtime.character.topics?.length) {
                elizaLogger.log("No topics available for search");
                return;
            }

            const searchTerm = [...this.runtime.character.topics][
                Math.floor(Math.random() * this.runtime.character.topics.length)
            ];

            elizaLogger.log("Fetching search jeets");
            await wait(5000);

            let searchResponse: JeetResponse = { jeets: [] };
            try {
                searchResponse = await this.client.simsAIClient.searchJeets(
                    searchTerm,
                    20
                );
                if (!searchResponse?.jeets?.length) {
                    elizaLogger.log(
                        `No jeets found for search term: "${searchTerm}"`
                    );
                }
            } catch (error) {
                elizaLogger.error("Error fetching search jeets:", error);
            }

            const discoveryTimeline =
                await this.client.simsAIClient.getDiscoveryTimeline(50);
            if (!discoveryTimeline) {
                elizaLogger.log("No discovery timeline available");
                return;
            }

            await this.client.cacheTimeline(discoveryTimeline.jeets || []);

            const formattedTimeline = this.formatDiscoveryTimeline(
                discoveryTimeline.jeets || []
            );

            // Get combined jeets and rank them
            const jeetsToProcess =
                (searchResponse.jeets?.length ?? 0) > 0
                    ? searchResponse.jeets
                    : discoveryTimeline.jeets || [];

            // Use our new ranking method
            elizaLogger.log("Ranking jeets for engagement");
            const rankedJeets = await this.filterAndRankJeets(jeetsToProcess);

            if (rankedJeets.length === 0) {
                elizaLogger.log("No valid jeets found for processing");
                return;
            }

            elizaLogger.log(
                `Found ${rankedJeets.length} ranked jeets to consider`
            );
            const prompt = this.generateSelectionPrompt(
                rankedJeets,
                searchTerm
            );

            const mostInterestingJeetResponse = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            const jeetId = mostInterestingJeetResponse.trim();
            const selectedJeet = rankedJeets.find(
                (jeet) =>
                    jeet.id.toString().includes(jeetId) ||
                    jeetId.includes(jeet.id.toString())
            );

            if (!selectedJeet) {
                elizaLogger.log("No matching jeet found for ID:", jeetId);
                return;
            }

            elizaLogger.log(`Selected jeet ${selectedJeet.id} for interaction`);

            const previousInteractions = {
                replied: await this.hasInteracted(selectedJeet.id, "reply"),
                liked: await this.hasInteracted(selectedJeet.id, "like"),
                rejeeted: await this.hasInteracted(selectedJeet.id, "rejeet"),
                quoted: await this.hasInteracted(selectedJeet.id, "quote"),
            };

            // Skip if we've already interacted with this jeet
            if (Object.values(previousInteractions).some((v) => v)) {
                elizaLogger.log(
                    `Already interacted with jeet ${selectedJeet.id}, skipping`
                );
                return;
            }

            await this.processSelectedJeet(
                selectedJeet,
                formattedTimeline,
                previousInteractions
            );
        } catch (error) {
            elizaLogger.error("Error engaging with search terms:", error);
            if (error instanceof Error && error.stack) {
                elizaLogger.error("Stack trace:", error.stack);
            }
        }
    }

    private formatDiscoveryTimeline(jeets: Jeet[]): string {
        if (!jeets?.length)
            return `# ${this.runtime.character.name}'s Home Timeline\n\nNo jeets available`;

        return (
            `# ${this.runtime.character.name}'s Home Timeline\n\n` +
            jeets
                .map((jeet) => {
                    return `ID: ${jeet.id}
From: ${jeet.agent?.name || "Unknown"} (@${jeet.agent?.username || "Unknown"})
Text: ${jeet.text}
---`;
                })
                .join("\n\n")
        );
    }

    private generateSelectionPrompt(jeets: Jeet[], searchTerm: string): string {
        return `
    Here are some jeets related to "${searchTerm}". As ${this.runtime.character.name}, you're looking for jeets that would benefit from your engagement and expertise.

    ${jeets
        .map(
            (jeet) => `
    ID: ${jeet.id}
    From: ${jeet.agent?.name || "Unknown"} (@${jeet.agent?.username || "Unknown"})
    Text: ${jeet.text}
    Metrics: ${JSON.stringify(jeet.public_metrics || {})}`
        )
        .join("\n---\n")}

    Which jeet would be most valuable to respond to as ${this.runtime.character.name}? Consider:
    - Posts that raise questions or points you can meaningfully contribute to
    - Posts that align with your expertise
    - Posts that could start a productive discussion
    - Posts in English without excessive hashtags/links
    - Avoid already heavily discussed posts or simple announcements
    - Avoid rejeets when possible

    Please ONLY respond with the ID of the single most promising jeet to engage with.`;
    }

    private scoreJeetForEngagement(jeet: Jeet): number {
        let score = 0;

        // Prefer jeets without too many replies already
        if (jeet.public_metrics?.reply_count < 3) score += 3;
        else if (jeet.public_metrics?.reply_count < 5) score += 1;

        // Avoid heavily rejeeted/quoted content
        if (jeet.public_metrics?.rejeet_count > 10) score -= 2;
        if (jeet.public_metrics?.quote_count > 5) score -= 1;

        // Prefer original content over rejeets
        if (jeet.isRejeet) score -= 3;

        // Avoid jeets with lots of hashtags/links
        const hashtagCount = (jeet.text?.match(/#/g) || []).length;
        const urlCount = (jeet.text?.match(/https?:\/\//g) || []).length;
        score -= hashtagCount + urlCount;

        // Prefer jeets with meaningful length (not too short, not too long)
        const textLength = jeet.text?.length || 0;
        if (textLength > 50 && textLength < 200) score += 2;

        // Prefer jeets that seem to ask questions or invite discussion
        if (jeet.text?.includes("?")) score += 2;
        const discussionWords = [
            "thoughts",
            "opinion",
            "what if",
            "how about",
            "discuss",
        ];
        if (
            discussionWords.some((word) =>
                jeet.text?.toLowerCase().includes(word)
            )
        )
            score += 2;

        return score;
    }

    private async filterAndRankJeets(jeets: Jeet[]): Promise<Jeet[]> {
        // First filter out basic invalid jeets
        const basicValidJeets = jeets.filter(
            (jeet) =>
                jeet &&
                jeet.text &&
                jeet.agent?.username !==
                    this.runtime.getSetting("SIMSAI_USERNAME")
        );

        // Then check interaction status for each jeet
        const validJeets = [];
        for (const jeet of basicValidJeets) {
            const hasInteracted = await this.hasInteracted(jeet.id, "reply");
            if (!hasInteracted) {
                validJeets.push(jeet);
            }
        }

        // Score and sort jeets
        const scoredJeets = validJeets.map((jeet) => ({
            jeet,
            score: this.scoreJeetForEngagement(jeet),
        }));

        // Sort by score and add some randomness for top jeets
        scoredJeets.sort((a, b) => b.score - a.score);

        // Take top 20 and add slight randomization while maintaining general score order
        const topJeets = scoredJeets.slice(0, 20).map(({ jeet }, index) => ({
            jeet,
            randomScore: Math.random() * 0.3 + (1 - index / 20), // Maintain rough ordering with some randomness
        }));

        topJeets.sort((a, b) => b.randomScore - a.randomScore);
        return topJeets.map(({ jeet }) => jeet);
    }

    private async processSelectedJeet(
        selectedJeet: Jeet,
        formattedTimeline: string,
        previousInteractions: {
            replied: boolean;
            liked: boolean;
            rejeeted: boolean;
            quoted: boolean;
        }
    ) {
        const roomId = stringToUuid(
            `${selectedJeet.conversationId || selectedJeet.id}-${this.runtime.agentId}`
        );
        const userIdUUID = stringToUuid(selectedJeet.agentId);

        await this.runtime.ensureConnection(
            userIdUUID,
            roomId,
            selectedJeet.agent?.username || "",
            selectedJeet.agent?.name || "",
            "jeeter"
        );

        const thread = await buildConversationThread(selectedJeet, this.client);
        elizaLogger.log(
            `Retrieved conversation thread with ${thread.length} messages:`,
            {
                messages: thread.map((t) => ({
                    id: t.id,
                    username: t.agent?.username,
                    text:
                        t.text?.slice(0, 50) +
                        (t.text?.length > 50 ? "..." : ""),
                    timestamp: t.createdAt,
                })),
            }
        );

        // Sort thread chronologically and handle timestamps
        const sortedThread = thread.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
        });

        // Enhanced formatting of conversation context with clear conversation flow
        const formattedConversation = sortedThread
            .map((j, index) => {
                const timestamp = j.createdAt
                    ? new Date(j.createdAt).getTime()
                    : Date.now();
                const isCurrentJeet = j.id === selectedJeet.id;
                const arrow = index > 0 ? "↪ " : ""; // Show reply chain
                return `[${new Date(timestamp).toLocaleString()}] ${arrow}@${
                    j.agent?.username || "unknown"
                }${isCurrentJeet ? " (current message)" : ""}: ${j.text}`;
            })
            .join("\n\n");

        // Log conversation context for debugging
        elizaLogger.log("Conversation context:", {
            originalJeet: selectedJeet.id,
            totalMessages: thread.length,
            participants: [...new Set(thread.map((j) => j.agent?.username))],
            timespan:
                thread.length > 1
                    ? {
                          first: new Date(
                              Math.min(
                                  ...thread.map((j) =>
                                      new Date(j.createdAt || 0).getTime()
                                  )
                              )
                          ),
                          last: new Date(
                              Math.max(
                                  ...thread.map((j) =>
                                      new Date(j.createdAt || 0).getTime()
                                  )
                              )
                          ),
                      }
                    : null,
        });

        const message = {
            id: stringToUuid(selectedJeet.id + "-" + this.runtime.agentId),
            agentId: this.runtime.agentId,
            content: {
                text: selectedJeet.text,
                inReplyTo: undefined,
            },
            userId: userIdUUID,
            roomId,
            createdAt: selectedJeet.createdAt
                ? new Date(selectedJeet.createdAt).getTime()
                : Date.now(),
        };

        if (!message.content.text) {
            return { text: "", action: "IGNORE" };
        }

        await this.handleJeetInteractions(
            message,
            selectedJeet,
            formattedTimeline,
            previousInteractions,
            formattedConversation,
            thread
        );
    }

    private async handleJeetInteractions(
        message: any,
        selectedJeet: Jeet,
        formattedTimeline: string,
        previousInteractions: {
            replied: boolean;
            liked: boolean;
            rejeeted: boolean;
            quoted: boolean;
        },
        formattedConversation: string,
        thread: Jeet[]
    ) {
        try {
            elizaLogger.log(`Composing state for jeet ${selectedJeet.id}`);
            let state = await this.runtime.composeState(message, {
                jeeterClient: this.client,
                jeeterUserName: this.runtime.getSetting("SIMSAI_USERNAME"),
                timeline: formattedTimeline,
                jeetContext: await this.buildJeetContext(selectedJeet),
                formattedConversation, // Add conversation context
                conversationContext: {
                    messageCount: thread.length,
                    participants: [
                        ...new Set(thread.map((j) => j.agent?.username)),
                    ],
                    timespan:
                        thread.length > 1
                            ? {
                                  start: new Date(
                                      Math.min(
                                          ...thread.map((j) =>
                                              new Date(
                                                  j.createdAt || 0
                                              ).getTime()
                                          )
                                      )
                                  ).toISOString(),
                                  end: new Date(
                                      Math.max(
                                          ...thread.map((j) =>
                                              new Date(
                                                  j.createdAt || 0
                                              ).getTime()
                                          )
                                      )
                                  ).toISOString(),
                              }
                            : null,
                },
                previousInteractions,
            });

            elizaLogger.log(
                `Saving request message for jeet ${selectedJeet.id}`
            );
            await this.client.saveRequestMessage(message, state as State);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.jeeterSearchTemplate ||
                    jeeterSearchTemplate,
            });

            elizaLogger.log(
                `Generating message response for jeet ${selectedJeet.id}`
            );
            const rawResponse = (await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            })) as EnhancedResponseContent;

            elizaLogger.debug("Raw response:", rawResponse);
            const response = {
                text: rawResponse.text,
                action: rawResponse.action,
                shouldLike: rawResponse.shouldLike,
                interactions: rawResponse.interactions || [],
            };

            if (!response.interactions) {
                throw new TypeError("Response interactions are undefined");
            }

            if (response.interactions.length > 0) {
                for (const interaction of response.interactions) {
                    try {
                        if (
                            (interaction.type === "reply" &&
                                previousInteractions.replied) ||
                            (interaction.type === "rejeet" &&
                                previousInteractions.rejeeted) ||
                            (interaction.type === "quote" &&
                                previousInteractions.quoted) ||
                            (interaction.type === "like" &&
                                previousInteractions.liked)
                        ) {
                            elizaLogger.log(
                                `Skipping ${interaction.type} for jeet ${selectedJeet.id} - already performed`
                            );
                            continue;
                        }

                        elizaLogger.log(
                            `Attempting ${interaction.type} interaction for jeet ${selectedJeet.id}`
                        );

                        switch (interaction.type) {
                            case "rejeet":
                                try {
                                    const rejeetResult =
                                        await this.client.simsAIClient.rejeetJeet(
                                            selectedJeet.id
                                        );
                                    if (rejeetResult?.id) {
                                        elizaLogger.log(
                                            `Rejeeted jeet ${selectedJeet.id}`
                                        );
                                        this.recordInteraction(
                                            selectedJeet.id,
                                            "rejeet"
                                        );
                                    } else {
                                        elizaLogger.error(
                                            `Failed to rejeet jeet ${selectedJeet.id}:`,
                                            rejeetResult
                                        );
                                    }
                                } catch (error) {
                                    elizaLogger.error(
                                        `Error processing rejeet for jeet ${selectedJeet.id}:`,
                                        error
                                    );
                                }
                                break;

                            case "quote":
                                if (interaction.text) {
                                    await this.client.simsAIClient.quoteRejeet(
                                        selectedJeet.id,
                                        interaction.text
                                    );
                                    elizaLogger.log(
                                        `Quote rejeeted jeet ${selectedJeet.id}`
                                    );
                                    this.recordInteraction(
                                        selectedJeet.id,
                                        "quote"
                                    );
                                }
                                break;

                            case "reply":
                                if (interaction.text) {
                                    const replyResponse = {
                                        ...response,
                                        text: interaction.text,
                                    };

                                    const responseMessages = await sendJeet(
                                        this.client,
                                        replyResponse,
                                        message.roomId,
                                        this.client.profile.username,
                                        selectedJeet.id
                                    );

                                    state =
                                        await this.runtime.updateRecentMessageState(
                                            state
                                        );

                                    for (const [
                                        idx,
                                        responseMessage,
                                    ] of responseMessages.entries()) {
                                        responseMessage.content.action =
                                            idx === responseMessages.length - 1
                                                ? response.action
                                                : "CONTINUE";
                                        await this.runtime.messageManager.createMemory(
                                            responseMessage
                                        );
                                    }

                                    await this.runtime.evaluate(message, state);
                                    await this.runtime.processActions(
                                        message,
                                        responseMessages,
                                        state
                                    );

                                    this.recordInteraction(
                                        selectedJeet.id,
                                        "reply"
                                    );
                                }
                                break;

                            case "like":
                                try {
                                    await this.client.simsAIClient.likeJeet(
                                        selectedJeet.id
                                    );
                                    elizaLogger.log(
                                        `Liked jeet ${selectedJeet.id}`
                                    );
                                    this.recordInteraction(
                                        selectedJeet.id,
                                        "like"
                                    );
                                } catch (error) {
                                    elizaLogger.error(
                                        `Error liking jeet ${selectedJeet.id}:`,
                                        error
                                    );
                                }
                                break;

                            case "none":
                                elizaLogger.log(
                                    `Chose not to interact with jeet ${selectedJeet.id}`
                                );
                                break;
                        }

                        elizaLogger.log(
                            `Successfully performed ${interaction.type} interaction for jeet ${selectedJeet.id}`
                        );
                    } catch (error) {
                        elizaLogger.error(
                            `Error processing interaction ${interaction.type} for jeet ${selectedJeet.id}:`,
                            error
                        );
                    }
                }
            }

            const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${
                selectedJeet.id
            } - @${selectedJeet.agent?.username || "unknown"}: ${
                selectedJeet.text
            }\nAgent's Output:\n${JSON.stringify(response)}`;

            elizaLogger.log(
                `Caching response info for jeet ${selectedJeet.id}`
            );
            await this.runtime.cacheManager.set(
                `jeeter/jeet_generation_${selectedJeet.id}.txt`,
                responseInfo
            );

            await wait();

            const interactionSummary = {
                jeetId: selectedJeet.id,
                liked: response.shouldLike,
                interactions: response.interactions.map((i) => i.type),
                replyText: response.text,
                quoteTexts: response.interactions
                    .filter((i) => i.type === "quote")
                    .map((i) => i.text),
            };
            elizaLogger.debug(
                `Interaction summary: ${JSON.stringify(interactionSummary)}`
            );
        } catch (error) {
            elizaLogger.error(`Error generating/sending response: ${error}`);
            throw error;
        }
    }

    private async buildJeetContext(selectedJeet: Jeet): Promise<string> {
        let context = `Original Post:\nBy @${selectedJeet.agent?.username || "unknown"}\n${selectedJeet.text}`;

        if (selectedJeet.thread?.length) {
            const replyContext = selectedJeet.thread
                .filter(
                    (reply: Jeet) =>
                        reply.agent?.username !==
                        this.runtime.getSetting("SIMSAI_USERNAME")
                )
                .map(
                    (reply: Jeet) =>
                        `@${reply.agent?.username || "unknown"}: ${reply.text}`
                )
                .join("\n");

            if (replyContext) {
                context += `\nReplies to original post:\n${replyContext}`;
            }
        }

        // Add media descriptions if they exist
        if (selectedJeet.media?.length) {
            const imageDescriptions = [];
            for (const media of selectedJeet.media) {
                // Check if the media has a URL and we can process it
                if ("url" in media) {
                    const description = this.runtime.getService(
                        ServiceType.IMAGE_DESCRIPTION
                    );

                    imageDescriptions.push(description);
                }
            }

            if (imageDescriptions.length > 0) {
                context += `\nMedia in Post (Described): ${imageDescriptions.join(", ")}`;
            }
        }

        // Add URLs if they exist
        if (selectedJeet.urls?.length) {
            context += `\nURLs: ${selectedJeet.urls.join(", ")}`;
        }

        // Add photos if they exist
        if (selectedJeet.photos?.length) {
            const photoDescriptions = [];
            for (const photo of selectedJeet.photos) {
                if (photo.url) {
                    const description = this.runtime.getService(
                        ServiceType.IMAGE_DESCRIPTION
                    );

                    photoDescriptions.push(description);
                }
            }

            if (photoDescriptions.length > 0) {
                context += `\nPhotos in Post (Described): ${photoDescriptions.join(", ")}`;
            }
        }

        // Add videos if they exist (just mentioning their presence)
        if (selectedJeet.videos?.length) {
            context += `\nVideos: ${selectedJeet.videos.length} video(s) attached`;
        }

        return context;
    }
}
