import {
    composeContext,
    generateMessageResponse,
    generateShouldRespond,
    shouldRespondFooter,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    stringToUuid,
    elizaLogger,
} from "@ai16z/eliza";
import { ClientBase } from "./base";
import { buildConversationThread, sendJeet, wait } from "./utils";
import { Jeet, EnhancedResponseContent } from "./types";
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
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
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
            elizaLogger.log(
                "Search response received:",
                JSON.stringify(searchResponse)
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
            elizaLogger.log(
                `Found ${commentsOnPosts.length} comments on posts`
            );

            // Combine mentions and comments, remove duplicates
            const allInteractions = [
                ...(searchResponse?.jeets || []),
                ...commentsOnPosts,
            ];

            const uniqueJeets = Array.from(
                new Map(allInteractions.map((jeet) => [jeet.id, jeet])).values()
            )
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((jeet) => jeet.userId !== this.client.profile.id);

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
                        `${jeet.conversationId || jeet.id}-${
                            this.runtime.agentId
                        }`
                    );
                    const userIdUUID = stringToUuid(jeet.userId);

                    elizaLogger.log(
                        `Ensuring connection for user ${jeet.username}`
                    );
                    await this.runtime.ensureConnection(
                        userIdUUID,
                        roomId,
                        jeet.username,
                        jeet.name || jeet.username,
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

                // Fetch the actual replies using conversation ID
                const replies = await this.client.fetchSearchJeets(
                    `conversation_id:${post.id}`,
                    20
                );

                if (replies?.jeets) {
                    // Filter out the original post and the agent's own replies
                    const validComments = replies.jeets.filter(
                        (reply) =>
                            reply.id !== post.id &&
                            reply.userId !== this.client.profile.id &&
                            !reply.isRejeet // Exclude retweets
                    );
                    comments.push(...validComments);
                }

                // Wait between requests to avoid rate limiting
                await wait(1000, 2000);
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
                `ID: ${j.id}\nFrom: ${j.name || j.username} (@${
                    j.username
                })\nText: ${j.text}`;

            const formattedHomeTimeline = homeTimeline
                .map((j) => `${formatJeet(j)}\n---\n`)
                .join("\n");

            const formattedConversation = thread
                .map(
                    (j) =>
                        `@${j.username} (${new Date(
                            j.timestamp * 1000
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

            const jeetId = stringToUuid(jeet.id + "-" + this.runtime.agentId);
            const jeetExists = await this.runtime.messageManager.getMemoryById(
                jeetId
            );

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
                    userId: stringToUuid(jeet.userId),
                    roomId: message.roomId,
                    createdAt: jeet.timestamp * 1000,
                };
                await this.client.saveRequestMessage(memoryMessage, state);
            }

            elizaLogger.log("Generating response");
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

            if (response.shouldLike) {
                try {
                    await this.client.simsAIClient.likeJeet(jeet.id);
                    elizaLogger.log(`Liked jeet ${jeet.id}`);
                } catch (error) {
                    elizaLogger.error(`Error liking jeet ${jeet.id}:`, error);
                }
            }

            for (const interaction of response.interactions) {
                try {
                    switch (interaction.type) {
                        case "rejeet":
                            await this.client.simsAIClient.rejeetJeet(jeet.id);
                            elizaLogger.log(`Rejeeted jeet ${jeet.id}`);
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
                            }
                            break;

                        case "reply":
                            if (interaction.text) {
                                const replyResponse = {
                                    ...response,
                                    text: interaction.text,
                                    inReplyTo: jeetId,
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
                            }
                            break;
                    }
                } catch (error) {
                    elizaLogger.error(
                        `Error processing interaction ${interaction.type}:`,
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

            const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${
                jeet.id
            } - ${jeet.username}: ${
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
