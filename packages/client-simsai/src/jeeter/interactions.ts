import {
    composeContext,
    generateMessageResponse,
    generateShouldRespond,
    shouldRespondFooter,
    IAgentRuntime,
    Memory,
    ModelClass,
    stringToUuid,
    elizaLogger,
} from "@ai16z/eliza";
import { ClientBase } from "./base";
import { buildConversationThread, sendJeet, wait } from "./utils";
import { Jeet, EnhancedResponseContent, JeetInteraction } from "./types";
import {
    JEETER_SHOULD_RESPOND_BASE,
    JEETER_MESSAGE_HANDLER_BASE,
    JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER,
} from "./constants";

export const jeeterMessageHandlerTemplate =
    JEETER_MESSAGE_HANDLER_BASE + JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER;
export const jeeterShouldRespondTemplate =
    JEETER_SHOULD_RESPOND_BASE + shouldRespondFooter;

export class JeeterInteractionClient {
    private likedJeets: Set<string> = new Set();
    private rejeetedJeets: Set<string> = new Set();
    private quotedJeets: Set<string> = new Set();
    private repliedJeets: Set<string> = new Set();
    constructor(
        private client: ClientBase,
        private runtime: IAgentRuntime
    ) {}

    private async hasInteracted(
        jeetId: string,
        type: JeetInteraction["type"],
        inReplyToStatusId?: string
    ): Promise<boolean> {
        // If this is a reply to our jeet, always allow response
        if (type === "reply" && inReplyToStatusId) {
            const parentJeet = await this.client.getJeet(inReplyToStatusId);
            if (parentJeet?.agentId === this.client.profile.id) {
                return false; // Allow replying to replies to our jeets
            }
        }

        // Otherwise check if we've already interacted
        switch (type) {
            case "like":
                return this.likedJeets.has(jeetId);
            case "rejeet":
                return this.rejeetedJeets.has(jeetId);
            case "quote":
                return this.quotedJeets.has(jeetId);
            case "reply":
                return this.repliedJeets.has(jeetId);
            default:
                return false;
        }
    }

    private recordInteraction(jeetId: string, type: JeetInteraction["type"]) {
        switch (type) {
            case "like":
                this.likedJeets.add(jeetId);
                break;
            case "rejeet":
                this.rejeetedJeets.add(jeetId);
                break;
            case "quote":
                this.quotedJeets.add(jeetId);
                break;
            case "reply":
                this.repliedJeets.add(jeetId);
                break;
        }
    }

    async start() {
        elizaLogger.log("Starting Jeeter Interaction Client");
        const handleJeeterInteractionsLoop = () => {
            try {
                this.handleJeeterInteractions().catch((error) => {
                    elizaLogger.error("Error in interaction loop:", error);
                });

                const nextInterval =
                    (Math.floor(Math.random() * (5 - 2 + 1)) + 2) * 60 * 1000;
                elizaLogger.log(
                    `Next check scheduled in ${nextInterval / 1000} seconds`
                );
                setTimeout(handleJeeterInteractionsLoop, nextInterval);
            } catch (error) {
                elizaLogger.error("Error in loop scheduling:", error);
                setTimeout(handleJeeterInteractionsLoop, 5 * 60 * 1000);
            }
        };
        handleJeeterInteractionsLoop();
    }

    async handleJeeterInteractions() {
        elizaLogger.log("Checking Jeeter interactions");

        try {
            const jeeterUsername = this.client.profile.username;
            elizaLogger.log(
                `Fetching mentions and comments for @${jeeterUsername}`
            );

            // Fetch mentions
            const searchResponse = await this.client.fetchSearchJeets(
                `@${jeeterUsername}`,
                20
            );

            // Fetch user's own posts
            let homeTimeline = await this.client.getCachedTimeline();
            if (!homeTimeline) {
                elizaLogger.log("Fetching home timeline");
                homeTimeline = await this.client.fetchHomeTimeline(20);
                await this.client.cacheTimeline(homeTimeline);
            }

            // Get comments on user's posts
            const commentsOnPosts = await this.getCommentsOnPosts(homeTimeline);

            // Combine mentions and comments, remove duplicates
            const allInteractions = [
                ...(searchResponse?.jeets || []),
                ...commentsOnPosts,
            ];

            const uniqueJeets = Array.from(
                new Map(allInteractions.map((jeet) => [jeet.id, jeet])).values()
            )
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((jeet) => jeet.agentId !== this.client.profile.id);

            elizaLogger.log(
                `Found ${uniqueJeets.length} unique interactions to process`
            );

            for (const jeet of uniqueJeets) {
                elizaLogger.log(
                    "Processing interaction:",
                    JSON.stringify(jeet)
                );

                if (!jeet.id) {
                    elizaLogger.warn("Skipping interaction without ID");
                    continue;
                }

                if (
                    this.client.lastCheckedJeetId &&
                    parseInt(jeet.id) <= parseInt(this.client.lastCheckedJeetId)
                ) {
                    elizaLogger.log(
                        `Skipping already processed interaction ${jeet.id}`
                    );
                    continue;
                }

                try {
                    const roomId = stringToUuid(
                        `${jeet.conversationId || jeet.id}-${this.runtime.agentId}`
                    );
                    const userIdUUID = stringToUuid(jeet.agentId);

                    elizaLogger.log(
                        `Ensuring connection for user ${jeet.agent?.username}`
                    );
                    await this.runtime.ensureConnection(
                        userIdUUID,
                        roomId,
                        jeet.agent?.username || "",
                        jeet.agent?.name || "",
                        "jeeter"
                    );

                    elizaLogger.log(
                        `Building conversation thread for interaction ${jeet.id}`
                    );
                    const thread = await buildConversationThread(
                        jeet,
                        this.client
                    );

                    const message: Memory = {
                        content: { text: jeet.text },
                        agentId: this.runtime.agentId,
                        userId: userIdUUID,
                        roomId,
                    };

                    elizaLogger.log(`Handling interaction ${jeet.id}`);
                    await this.handleJeet({
                        jeet,
                        message,
                        thread,
                    });

                    this.client.lastCheckedJeetId = jeet.id;

                    elizaLogger.log(
                        `Successfully processed interaction ${jeet.id}`
                    );
                } catch (error) {
                    elizaLogger.error(
                        `Error processing interaction ${jeet.id}:`,
                        error
                    );
                    if (error instanceof Error) {
                        elizaLogger.error("Error details:", {
                            message: error.message,
                            stack: error.stack,
                        });
                    }
                }
            }

            await this.client.cacheLatestCheckedJeetId();
            elizaLogger.log("Finished checking Jeeter interactions");
        } catch (error) {
            elizaLogger.error("Error in handleJeeterInteractions:", error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
        }
    }

    private async getCommentsOnPosts(posts: Jeet[]): Promise<Jeet[]> {
        const comments: Jeet[] = [];

        for (const post of posts) {
            try {
                if (!post.public_metrics?.reply_count) {
                    continue;
                }

                elizaLogger.log(`Fetching conversation for post ${post.id}`);
                // Use the correct endpoint to get full conversation
                const conversation =
                    await this.client.simsAIClient.getJeetConversation(post.id);

                if (conversation) {
                    // Filter out the original post and the agent's own replies
                    const validComments = conversation
                        .filter(
                            (reply) =>
                                reply.id !== post.id && // Not the original post
                                reply.agentId !== this.client.profile.id && // Not our own replies
                                !reply.isRejeet // Not a rejeet
                        )
                        .sort((a, b) => {
                            const timeA = new Date(a.createdAt || 0).getTime();
                            const timeB = new Date(b.createdAt || 0).getTime();
                            return timeB - timeA; // Newest first
                        });

                    comments.push(...validComments);
                }

                await wait(1000, 2000); // Rate limiting delay
            } catch (error) {
                elizaLogger.error(
                    `Error fetching comments for post ${post.id}:`,
                    error
                );
            }
        }

        return comments;
    }

    private async handleJeet({
        jeet,
        message,
        thread,
    }: {
        jeet: Jeet;
        message: Memory;
        thread: Jeet[];
    }) {
        elizaLogger.log(`Starting handleJeet for ${jeet.id}`);

        try {
            if (!message.content.text) {
                elizaLogger.log(`Skipping jeet ${jeet.id} - no text content`);
                return { text: "", action: "IGNORE" };
            }

            let homeTimeline = await this.client.getCachedTimeline();
            if (!homeTimeline) {
                elizaLogger.log("Fetching home timeline");
                homeTimeline = await this.client.fetchHomeTimeline(50);
                await this.client.cacheTimeline(homeTimeline);
            }

            const formatJeet = (j: Jeet) =>
                `ID: ${j.id}\nFrom: ${j.agent?.name || "Unknown"} (@${j.agent?.username || "Unknown"})\nText: ${j.text}`;

            const formattedHomeTimeline = homeTimeline
                .map((j) => `${formatJeet(j)}\n---\n`)
                .join("\n");

            const formattedConversation = thread
                .map(
                    (j) =>
                        `@${j.agent?.username || "unknown"} (${new Date(
                            j.createdAt
                                ? new Date(j.createdAt).getTime()
                                : Date.now()
                        ).toLocaleString()}): ${j.text}`
                )
                .join("\n\n");

            elizaLogger.log("Composing state");
            let state = await this.runtime.composeState(message, {
                jeeterClient: this.client.simsAIClient,
                jeeterUserName: this.client.profile.username,
                currentPost: formatJeet(jeet),
                formattedConversation,
                timeline: `# ${this.runtime.character.name}'s Home Timeline\n\n${formattedHomeTimeline}`,
            });

            elizaLogger.log("Checking if should respond");
            const shouldRespondContext = composeContext({
                state,
                template:
                    this.runtime.character?.templates
                        ?.jeeterShouldRespondTemplate ||
                    jeeterShouldRespondTemplate,
            });

            const shouldRespond = await generateShouldRespond({
                runtime: this.runtime,
                context: shouldRespondContext,
                modelClass: ModelClass.MEDIUM,
            });

            if (shouldRespond !== "RESPOND") {
                elizaLogger.log(`Not responding to jeet ${jeet.id}`);
                return { text: "Response Decision:", action: shouldRespond };
            }

            // Only create memory and process interaction if we're going to respond
            const jeetId = stringToUuid(jeet.id + "-" + this.runtime.agentId);
            const jeetExists =
                await this.runtime.messageManager.getMemoryById(jeetId);

            if (!jeetExists) {
                elizaLogger.log("Creating new memory for jeet");
                const memoryMessage = {
                    id: jeetId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: jeet.text,
                        inReplyTo: jeet.inReplyToStatusId
                            ? stringToUuid(
                                  jeet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    },
                    userId: stringToUuid(jeet.agentId),
                    roomId: message.roomId,
                    createdAt: jeet.createdAt
                        ? new Date(jeet.createdAt).getTime()
                        : Date.now(),
                };
                await this.client.saveRequestMessage(memoryMessage, state);
            }

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates
                        ?.jeeterMessageHandlerTemplate ||
                    this.runtime.character?.templates?.messageHandlerTemplate ||
                    jeeterMessageHandlerTemplate,
            });

            const response = (await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            })) as EnhancedResponseContent;

            response.interactions = response.interactions || [];

            // Process interactions
            if (response.interactions.length > 0) {
                for (const interaction of response.interactions) {
                    try {
                        if (
                            await this.hasInteracted(
                                jeet.id,
                                interaction.type,
                                jeet.inReplyToStatusId
                            )
                        ) {
                            elizaLogger.log(
                                `Skipping ${interaction.type} for jeet ${jeet.id} - already performed`
                            );
                            continue;
                        }

                        switch (interaction.type) {
                            case "like":
                                try {
                                    await this.client.simsAIClient.likeJeet(
                                        jeet.id
                                    );
                                    elizaLogger.log(
                                        `Liked interaction ${jeet.id}`
                                    );
                                    this.recordInteraction(jeet.id, "like");
                                } catch (error) {
                                    elizaLogger.error(
                                        `Error liking interaction ${jeet.id}:`,
                                        error
                                    );
                                }
                                break;

                            case "rejeet":
                                try {
                                    const rejeetResult =
                                        await this.client.simsAIClient.rejeetJeet(
                                            jeet.id
                                        );
                                    if (rejeetResult?.id) {
                                        // Check for Jeet ID directly
                                        elizaLogger.log(
                                            `Rejeeted jeet ${jeet.id}`
                                        );
                                        this.recordInteraction(
                                            jeet.id,
                                            "rejeet"
                                        );
                                    } else {
                                        elizaLogger.error(
                                            `Failed to rejeet jeet ${jeet.id}: Invalid response`
                                        );
                                    }
                                } catch (error) {
                                    elizaLogger.error(
                                        `Error rejeeting jeet ${jeet.id}:`,
                                        error
                                    );
                                }
                                break;

                            case "quote":
                                if (interaction.text) {
                                    await this.client.simsAIClient.quoteRejeet(
                                        jeet.id,
                                        interaction.text
                                    );
                                    elizaLogger.log(
                                        `Quote rejeeted jeet ${jeet.id}`
                                    );
                                    this.recordInteraction(jeet.id, "quote");
                                }
                                break;

                            case "reply":
                                if (interaction.text) {
                                    if (
                                        await this.hasInteracted(
                                            jeet.id,
                                            "reply",
                                            jeet.inReplyToStatusId
                                        )
                                    ) {
                                        elizaLogger.log(
                                            `Already replied to jeet ${jeet.id}`
                                        );
                                        continue;
                                    }

                                    const replyResponse = {
                                        ...response,
                                        text: interaction.text,
                                    };

                                    const responseMessages = await sendJeet(
                                        this.client,
                                        replyResponse,
                                        message.roomId,
                                        this.client.profile.username,
                                        jeet.id
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

                                    this.recordInteraction(jeet.id, "reply");
                                }
                                break;

                            case "none":
                                elizaLogger.log(
                                    `No interaction needed for jeet ${jeet.id}`
                                );
                                break;
                        }
                    } catch (error) {
                        elizaLogger.error(
                            `Error processing interaction ${interaction.type}:`,
                            error
                        );
                    }
                }
            }

            const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${
                jeet.id
            } - ${jeet.agent?.username || "unknown"}: ${
                jeet.text
            }\nAgent's Output:\n${JSON.stringify(response)}`;

            await this.runtime.cacheManager.set(
                `jeeter/jeet_generation_${jeet.id}.txt`,
                responseInfo
            );

            await wait();
            return response;
        } catch (error) {
            elizaLogger.error(`Error in handleJeet for ${jeet.id}:`, error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
            return { text: "Error processing jeet", action: "IGNORE" };
        }
    }
}
