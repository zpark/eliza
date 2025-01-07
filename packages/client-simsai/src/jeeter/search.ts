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
import { EnhancedResponseContent, Jeet, JeetResponse } from "./types";
import { ClientBase } from "./base";
import {
    JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER,
    JEETER_SEARCH_BASE,
} from "./constants";

const jeeterSearchTemplate =
    JEETER_SEARCH_BASE + JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER;

export class JeeterSearchClient {
    private repliedJeets: Set<string> = new Set();
    private rejeetedJeets: Set<string> = new Set();
    private quotedJeets: Set<string> = new Set();

    constructor(
        private client: ClientBase,
        private runtime: IAgentRuntime
    ) {}

    private async hasInteracted(
        jeetId: string,
        type: "reply" | "rejeet" | "quote"
    ): Promise<boolean> {
        switch (type) {
            case "reply":
                return this.repliedJeets.has(jeetId);
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
        type: "reply" | "rejeet" | "quote"
    ) {
        switch (type) {
            case "reply":
                this.repliedJeets.add(jeetId);
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
            // Check if topics exist and are not empty
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

            const jeetsToProcess =
                (searchResponse.jeets?.length ?? 0) > 0
                    ? searchResponse.jeets
                    : discoveryTimeline.jeets || [];

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
                rejeeted: await this.hasInteracted(selectedJeet.id, "rejeet"),
                quoted: await this.hasInteracted(selectedJeet.id, "quote"),
            };

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
Here are some jeets related to the search term "${searchTerm}":

${jeets
    .map(
        (jeet) => `
ID: ${jeet.id}
From: ${jeet.agent?.name || "Unknown"} (@${jeet.agent?.username || "Unknown"})
Text: ${jeet.text}`
    )
    .join("\n---\n")}

Which jeet is the most interesting and relevant for ${this.runtime.character.name} to reply to?
Please provide only the ID of the jeet in your response.
Notes:
- Respond to English jeets only
- Respond to jeets that don't have a lot of hashtags, links, URLs or images
- Respond to jeets that are not rejeets
- Consider jeets that could be quoted or rejeeted
- ONLY respond with the ID of the jeet`;
    }

    private async processSelectedJeet(
        selectedJeet: any,
        formattedTimeline: string,
        previousInteractions: {
            replied: boolean;
            rejeeted: boolean;
            quoted: boolean;
        }
    ) {
        const roomId = stringToUuid(
            selectedJeet.id + "-" + this.runtime.agentId
        );
        const userIdUUID = stringToUuid(selectedJeet.agentId);

        await this.runtime.ensureConnection(
            userIdUUID,
            roomId,
            selectedJeet.agent.username,
            selectedJeet.agent.name,
            "jeeter"
        );

        await buildConversationThread(selectedJeet, this.client);

        const message = {
            id: stringToUuid(selectedJeet.id + "-" + this.runtime.agentId),
            agentId: this.runtime.agentId,
            content: {
                text: selectedJeet.text,
                inReplyTo: undefined,
            },
            userId: userIdUUID,
            roomId,
            createdAt: new Date(selectedJeet.createdAt).getTime(),
        };

        if (!message.content.text) {
            return { text: "", action: "IGNORE" };
        }

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

            elizaLogger.debug("State:", state);
            elizaLogger.debug("Jeet context:", selectedJeet);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.jeeterSearchTemplate ||
                    jeeterSearchTemplate,
            });

            elizaLogger.debug("Context:", context);

            const rawResponse = (await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            })) as EnhancedResponseContent;

            elizaLogger.debug("Raw response:", rawResponse);

            const response = {
                text: rawResponse.text,
                action: rawResponse.action,
                interactions: rawResponse.interactions,
            };

            if (!response || !response.interactions || !response.text) {
                throw new TypeError("Response or interactions are undefined");
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

                                    const responseMessages = await sendJeet(
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

                            case "none":
                                elizaLogger.log(
                                    `Chose not to interact with jeet ${selectedJeet.id}`
                                );
                                break;
                        }
                    } catch (error) {
                        elizaLogger.error(
                            `Error processing interaction ${interaction.type} for jeet ${selectedJeet.id}:`,
                            error instanceof Error ? error.message : error
                        );
                    }
                }
            }

            const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${selectedJeet.id} - @${
                selectedJeet.agent.username
            }: ${selectedJeet.text}\nAgent's Output:\n${JSON.stringify(response)}`;

            await this.runtime.cacheManager.set(
                `jeeter/jeet_generation_${selectedJeet.id}.txt`,
                responseInfo
            );

            await wait();

            const interactionSummary = {
                jeetId: selectedJeet.id,
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

    private async buildJeetContext(selectedJeet: any): Promise<string> {
        let context = `Original Post:\nBy @${selectedJeet.agent.username}\n${selectedJeet.text}`;

        // Add reply context if it exists
        if (selectedJeet.thread?.length) {
            const replyContext = selectedJeet.thread
                .filter(
                    (reply: any) =>
                        reply.agent.username !==
                        this.runtime.getSetting("SIMSAI_USERNAME")
                )
                .map((reply: any) => `@${reply.agent.username}: ${reply.text}`)
                .join("\n");

            if (replyContext) {
                context += `\nReplies to original post:\n${replyContext}`;
            }
        }

        // Add media descriptions if they exist
        if (selectedJeet.media?.length) {
            const imageDescriptions = [];

            for (const media of selectedJeet.media) {
                if (media.url) {
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

        return context;
    }
}
