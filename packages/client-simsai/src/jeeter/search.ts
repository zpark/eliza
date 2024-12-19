import {
    composeContext,
    elizaLogger,
    generateMessageResponse,
    generateText,
    IAgentRuntime,
    IImageDescriptionService,
    ModelClass,
    ServiceType,
    State,
    stringToUuid,
} from "@ai16z/eliza";
import { buildConversationThread, sendJeet, wait } from "./utils";
import { EnhancedResponseContent } from "./types";
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

    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    private async hasInteracted(
        jeetId: string,
        type: "reply" | "like" | "rejeet" | "quote"
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

    private recordInteraction(
        jeetId: string,
        type: "reply" | "like" | "rejeet" | "quote"
    ) {
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
        const handleJeeterInteractionsLoop = () => {
            this.engageWithSearchTerms();
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
            const searchTerm = [...this.runtime.character.topics][
                Math.floor(Math.random() * this.runtime.character.topics.length)
            ];

            elizaLogger.log("Fetching search jeets");
            await new Promise((resolve) => setTimeout(resolve, 5000));

            let searchResponse = { jeets: [] };
            try {
                searchResponse = await this.client.fetchSearchJeets(
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
                (await this.client.fetchDiscoveryTimeline(50)) || [];
            await this.client.cacheTimeline(discoveryTimeline);
            const formattedDiscoveryTimeline =
                this.formatDiscoveryTimeline(discoveryTimeline);

            const jeetsToProcess =
                searchResponse.jeets.length > 0
                    ? searchResponse.jeets
                    : discoveryTimeline;

            const validJeets = jeetsToProcess.filter(
                (jeet) =>
                    jeet &&
                    jeet.text &&
                    jeet.agent?.username !==
                        this.runtime.getSetting("SIMSAI_USERNAME")
            );

            const slicedJeets = validJeets
                .sort(() => Math.random() - 0.5)
                .slice(0, 20);

            if (slicedJeets.length === 0) {
                elizaLogger.log("No valid jeets found for processing");
                return;
            }

            const prompt = this.generateSelectionPrompt(
                slicedJeets,
                searchTerm
            );

            const mostInterestingJeetResponse = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            const jeetId = mostInterestingJeetResponse.trim();
            const selectedJeet = slicedJeets.find(
                (jeet) =>
                    jeet.id.toString().includes(jeetId) ||
                    jeetId.includes(jeet.id.toString())
            );

            if (!selectedJeet) {
                elizaLogger.log("No matching jeet found for ID:", jeetId);
                return;
            }

            const previousInteractions = {
                replied: await this.hasInteracted(selectedJeet.id, "reply"),
                liked: await this.hasInteracted(selectedJeet.id, "like"),
                rejeeted: await this.hasInteracted(selectedJeet.id, "rejeet"),
                quoted: await this.hasInteracted(selectedJeet.id, "quote"),
            };

            elizaLogger.log("Selected jeet to potentially interact with:", {
                text: selectedJeet.text,
                previousInteractions,
            });

            await this.processSelectedJeet(
                selectedJeet,
                formattedDiscoveryTimeline,
                previousInteractions
            );
        } catch (error) {
            elizaLogger.error(
                "Error engaging with search terms:",
                error instanceof Error ? error.message : error
            );
            if (error instanceof Error && error.stack) {
                elizaLogger.error("Stack trace:", error.stack);
            }
        }
    }

    private formatDiscoveryTimeline(timeline: any[]): string {
        return (
            `# ${this.runtime.character.name}'s Home Timeline\n\n` +
            timeline
                .map(
                    (jeet) =>
                        `ID: ${jeet.id}\nFrom: ${jeet.agent.name} (@${
                            jeet.agent.username
                        })${
                            jeet.inReplyToStatusId
                                ? ` In reply to: ${jeet.inReplyToStatusId}`
                                : ""
                        }\nText: ${jeet.text}\n---\n`
                )
                .join("\n")
        );
    }

    private generateSelectionPrompt(jeets: any[], searchTerm: string): string {
        return `
            Here are some jeets related to the search term "${searchTerm}":

            ${jeets
                .map(
                    (jeet) => `
                ID: ${jeet.id}${
                        jeet.inReplyToStatusId
                            ? ` In reply to: ${jeet.inReplyToStatusId}`
                            : ""
                    }
                From: ${jeet.agent.name} (@${jeet.agent.username})
                Text: ${jeet.text}
            `
                )
                .join("\n")}

            Which jeet is the most interesting and relevant for ${
                this.runtime.character.name
            } to reply to?
            Please provide only the ID of the jeet in your response.
            Notes:
            - Respond to English jeets only
            - Respond to jeets that don't have a lot of hashtags, links, URLs or images
            - Respond to jeets that are not rejeets
            - Consider jeets that could be quoted or rejeeted
            - ONLY respond with the ID of the jeet`;
    }

    private createMessageObject(
        selectedJeet: any,
        userIdUUID: string,
        roomId: string
    ) {
        return {
            id: stringToUuid(
                (selectedJeet.id || "") + "-" + this.runtime.agentId
            ),
            agentId: this.runtime.agentId,
            content: {
                text: selectedJeet.text,
                url: selectedJeet.permanentUrl,
                inReplyTo: selectedJeet.inReplyToStatusId
                    ? stringToUuid(
                          selectedJeet.inReplyToStatusId.toString() +
                              "-" +
                              this.runtime.agentId
                      )
                    : undefined,
            },
            userId: userIdUUID,
            roomId,
            createdAt: selectedJeet.timestamp * 1000,
        };
    }

    private async processSelectedJeet(
        selectedJeet: any,
        formattedTimeline: string,
        previousInteractions: {
            replied: boolean;
            liked: boolean;
            rejeeted: boolean;
            quoted: boolean;
        }
    ) {
        const conversationId = selectedJeet.conversationId || "";
        const roomId = stringToUuid(
            conversationId + "-" + this.runtime.agentId
        );
        const userIdUUID = stringToUuid(
            selectedJeet.userId ? selectedJeet.userId.toString() : ""
        );

        await this.runtime.ensureConnection(
            userIdUUID,
            roomId,
            selectedJeet.agent.username,
            selectedJeet.agent.name,
            "jeeter"
        );

        await buildConversationThread(selectedJeet, this.client);

        const message = this.createMessageObject(
            selectedJeet,
            userIdUUID,
            roomId
        );

        if (!message.content.text) {
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log("message", message);
        elizaLogger.log("selectedJeet", selectedJeet);

        await this.handleJeetInteractions(
            message,
            selectedJeet,
            formattedTimeline,
            previousInteractions
        );
    }

    private async handleJeetInteractions(
        message: any,
        selectedJeet: any,
        formattedTimeline: string,
        previousInteractions: {
            replied: boolean;
            liked: boolean;
            rejeeted: boolean;
            quoted: boolean;
        }
    ) {
        try {
            let state = await this.runtime.composeState(message, {
                jeeterClient: this.client,
                jeeterUserName: this.runtime.getSetting("SIMSAI_USERNAME"),
                timeline: formattedTimeline,
                jeetContext: await this.buildJeetContext(selectedJeet),
                previousInteractions,
            });

            await this.client.saveRequestMessage(message, state as State);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.jeeterSearchTemplate ||
                    jeeterSearchTemplate,
            });

            let response: EnhancedResponseContent;

            const rawResponse = (await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            })) as EnhancedResponseContent;

            elizaLogger.debug("Raw response:", rawResponse);
            response = {
                text: rawResponse.text,
                action: rawResponse.action,
                shouldLike: rawResponse.shouldLike,
                interactions: rawResponse.interactions,
            };

            elizaLogger.debug("Processed response:", response);

            if (!response || !response.interactions || !response.text) {
                throw new TypeError("Response or interactions are undefined");
            }

            if (response.interactions.length > 0 || response.shouldLike) {
                elizaLogger.log(
                    `Chosen interactions for jeet ${selectedJeet.id}:${
                        response.shouldLike ? " [LIKE]" : ""
                    }${response.interactions
                        .map((i) => ` [${i.type.toUpperCase()}]`)
                        .join("")}`
                );
            }

            if (response && response.interactions) {
                if (response.shouldLike && !previousInteractions.liked) {
                    try {
                        await this.client.simsAIClient.likeJeet(
                            selectedJeet.id
                        );
                        elizaLogger.log(`Liked jeet ${selectedJeet.id}`);
                        this.recordInteraction(selectedJeet.id, "like");
                    } catch (error) {
                        elizaLogger.error(
                            `Error liking jeet ${selectedJeet.id}:`,
                            error
                        );
                    }
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
                                    previousInteractions.quoted)
                            ) {
                                elizaLogger.log(
                                    `Skipping ${interaction.type} for jeet ${selectedJeet.id} - already performed`
                                );
                                continue;
                            }

                            switch (interaction.type) {
                                case "rejeet":
                                    await this.client.simsAIClient.rejeetJeet(
                                        selectedJeet.id
                                    );
                                    elizaLogger.log(
                                        `Rejeeted jeet ${selectedJeet.id}`
                                    );
                                    this.recordInteraction(
                                        selectedJeet.id,
                                        "rejeet"
                                    );
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
                                            inReplyTo: stringToUuid(
                                                selectedJeet.id +
                                                    "-" +
                                                    this.runtime.agentId
                                            ),
                                        };

                                        try {
                                            const responseMessages =
                                                await sendJeet(
                                                    this.client,
                                                    replyResponse,
                                                    message.roomId,
                                                    this.runtime.getSetting(
                                                        "SIMSAI_USERNAME"
                                                    ),
                                                    selectedJeet.id
                                                );

                                            state =
                                                await this.runtime.updateRecentMessageState(
                                                    state
                                                );

                                            for (const responseMessage of responseMessages) {
                                                if (
                                                    responseMessage ===
                                                    responseMessages[
                                                        responseMessages.length -
                                                            1
                                                    ]
                                                ) {
                                                    responseMessage.content.action =
                                                        response.action;
                                                } else {
                                                    responseMessage.content.action =
                                                        "CONTINUE";
                                                }
                                                await this.runtime.messageManager.createMemory(
                                                    responseMessage
                                                );
                                            }

                                            await this.runtime.evaluate(
                                                message,
                                                state
                                            );
                                            await this.runtime.processActions(
                                                message,
                                                responseMessages,
                                                state
                                            );

                                            this.recordInteraction(
                                                selectedJeet.id,
                                                "reply"
                                            );
                                        } catch (error) {
                                            elizaLogger.error(
                                                "Error processing reply interaction:",
                                                error
                                            );
                                        }
                                    }
                                    break;

                                case "none":
                                    elizaLogger.log(
                                        `Chose not to interact with jeet ${selectedJeet.id}`
                                    );
                                    break;
                            }
                        } catch (error) {
                            elizaLogger.error(
                                `Error processing interaction ${interaction.type} for jeet ${selectedJeet.id}:`,
                                error
                            );
                        }
                    }
                }
            }

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

            const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${
                selectedJeet.id
            } - ${selectedJeet.agent.username}: ${
                selectedJeet.text
            }\nAgent's Output:\n${JSON.stringify(response)}`;

            await this.runtime.cacheManager.set(
                `jeeter/jeet_generation_${selectedJeet.id}.txt`,
                responseInfo
            );

            await wait();
        } catch (error) {
            elizaLogger.error(`Error generating/sending response: ${error}`);
            throw error;
        }
    }

    private async buildJeetContext(selectedJeet: any): Promise<string> {
        const replyContext = (selectedJeet.thread || [])
            .filter(
                (reply: any) =>
                    reply.username !==
                    this.runtime.getSetting("SIMSAI_USERNAME")
            )
            .map((reply: any) => `@${reply.username}: ${reply.text}`)
            .join("\n");

        let context = `Original Post:\nBy @${selectedJeet.agent.username}\n${selectedJeet.text}`;

        if (replyContext) {
            context += `\nReplies to original post:\n${replyContext}`;
        }

        if (selectedJeet.urls?.length) {
            context += `\nURLs: ${selectedJeet.urls.join(", ")}`;
        }

        if (selectedJeet.photos?.length) {
            const imageDescriptions = [];
            for (const photo of selectedJeet.photos) {
                const description = await this.runtime
                    .getService<IImageDescriptionService>(
                        ServiceType.IMAGE_DESCRIPTION
                    )
                    .describeImage(photo.url);
                imageDescriptions.push(description);
            }

            if (imageDescriptions.length > 0) {
                context += `\nImages in Post (Described): ${imageDescriptions.join(
                    ", "
                )}`;
            }
        }

        return context;
    }
}
