import { Jeet, ApiPostJeetResponse } from "./types";
import {
    composeContext,
    generateText,
    getEmbeddingZeroVector,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
    elizaLogger,
} from "@ai16z/eliza";
import { ClientBase } from "./base";
import { JEETER_API_URL, MAX_JEET_LENGTH } from "./constants";
import { truncateToCompleteSentence } from "./utils";

const jeeterPostTemplate = `{{timeline}}

# Knowledge
{{knowledge}}

About {{agentName}} (@{{jeeterUserName}}):
{{bio}}
{{lore}}
{{postDirections}}

{{providers}}

{{recentPosts}}

{{characterPostExamples}}

# Task: Generate a post in the voice and style of {{agentName}}, aka @{{jeeterUserName}}
Write a single sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Try to write something totally different than previous posts. Do not add commentary or acknowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;

export class JeeterPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start(postImmediately: boolean = false) {
        if (!this.client.profile) {
            await this.client.init();
        }

        const generateNewJeetLoop = async () => {
            try {
                const lastPost = await this.runtime.cacheManager.get<{
                    timestamp: number;
                }>(`jeeter/${this.client.profile.username}/lastPost`);

                const lastPostTimestamp = lastPost?.timestamp ?? 0;
                const minMinutes =
                    parseInt(this.runtime.getSetting("POST_INTERVAL_MIN")) ||
                    90;
                const maxMinutes =
                    parseInt(this.runtime.getSetting("POST_INTERVAL_MAX")) ||
                    180;
                const randomMinutes =
                    Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) +
                    minMinutes;
                const delay = randomMinutes * 60 * 1000;

                if (Date.now() > lastPostTimestamp + delay) {
                    await this.generateNewJeet();
                }

                setTimeout(() => {
                    generateNewJeetLoop(); // Set up next iteration
                }, delay);

                elizaLogger.log(
                    `Next jeet scheduled in ${randomMinutes} minutes`
                );
            } catch (error) {
                elizaLogger.error("Error in generateNewJeetLoop:", error);
                // Retry after a delay if there's an error
                setTimeout(
                    () => {
                        generateNewJeetLoop();
                    },
                    5 * 60 * 1000
                ); // 5 minutes
            }
        };

        if (postImmediately) {
            await this.generateNewJeet();
        }

        generateNewJeetLoop();
    }

    private async getHomeTimeline(): Promise<Jeet[]> {
        const cachedTimeline = await this.client.getCachedTimeline();
        if (cachedTimeline) {
            return cachedTimeline;
        }

        const homeTimeline = await this.client.fetchHomeTimeline(50);
        await this.client.cacheTimeline(homeTimeline);
        return homeTimeline;
    }

    private formatHomeTimeline(homeTimeline: Jeet[]): string {
        return (
            `# ${this.runtime.character.name}'s Home Timeline\n\n` +
            homeTimeline
                .map((jeet) => {
                    const timestamp = jeet.createdAt
                        ? new Date(jeet.createdAt).toDateString()
                        : new Date().toDateString();

                    return `#${jeet.id}
${jeet.agent?.name || "Unknown"} (@${jeet.agent?.username || "Unknown"})${
                        jeet.inReplyToStatusId
                            ? `\nIn reply to: ${jeet.inReplyToStatusId}`
                            : ""
                    }
${timestamp}\n\n${jeet.text}\n---\n`;
                })
                .join("\n")
        );
    }

    private async generateJeetContent(): Promise<string> {
        const topics = this.runtime.character.topics.join(", ");
        const homeTimeline = await this.getHomeTimeline();
        const formattedHomeTimeline = this.formatHomeTimeline(homeTimeline);

        const state = await this.runtime.composeState(
            {
                userId: this.runtime.agentId,
                roomId: stringToUuid("SIMSAI_generate_room"),
                agentId: this.runtime.agentId,
                content: {
                    text: topics,
                    action: "",
                },
            },
            {
                jeeterUserName: this.client.profile.username,
                timeline: formattedHomeTimeline,
            }
        );

        const context = composeContext({
            state,
            template:
                this.runtime.character.templates?.jeeterPostTemplate ||
                jeeterPostTemplate,
        });

        elizaLogger.debug("generate post prompt:\n" + context);

        const newJeetContent = await generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        // Replace \n with proper line breaks and trim excess spaces
        const formattedJeet = newJeetContent.replace(/\\n/g, "\n").trim();

        // Use the helper function to truncate to complete sentence
        return truncateToCompleteSentence(formattedJeet, MAX_JEET_LENGTH);
    }

    private async createMemoryForJeet(
        jeet: Jeet,
        content: string
    ): Promise<void> {
        const roomId = stringToUuid(jeet.id + "-" + this.runtime.agentId);

        await this.runtime.ensureRoomExists(roomId);
        await this.runtime.ensureParticipantInRoom(
            this.runtime.agentId,
            roomId
        );

        await this.runtime.messageManager.createMemory({
            id: stringToUuid(jeet.id + "-" + this.runtime.agentId),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            content: {
                text: content,
                url: jeet.permanentUrl,
                source: "jeeter",
            },
            roomId,
            embedding: getEmbeddingZeroVector(),
            createdAt: new Date(jeet.createdAt).getTime(),
        });
    }

    private async postJeet(content: string): Promise<Jeet> {
        const response = await this.client.requestQueue.add(async () => {
            const result = await this.client.simsAIClient.postJeet(content);
            return result as unknown as ApiPostJeetResponse;
        });

        if (!response?.data?.id) {
            throw new Error(
                `Failed to get valid response from postJeet: ${JSON.stringify(response)}`
            );
        }

        elizaLogger.log(`Jeet posted with ID: ${response.data.id}`);

        // Extract the author information from includes
        const author = response.includes.users.find(
            (user) => user.id === response.data.author_id
        );

        // Construct the jeet from the response data
        return {
            id: response.data.id,
            text: response.data.text,
            createdAt: response.data.created_at,
            agentId: response.data.author_id,
            agent: author,
            permanentUrl: `${JEETER_API_URL}/${this.client.profile.username}/status/${response.data.id}`,
            public_metrics: response.data.public_metrics,
            hashtags: [],
            mentions: [],
            photos: [],
            thread: [],
            urls: [],
            videos: [],
            media: [],
            type: response.data.type,
        };
    }

    private async generateNewJeet() {
        elizaLogger.log("Generating new jeet");

        try {
            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.client.profile.username,
                this.runtime.character.name,
                "jeeter"
            );

            const content = await this.generateJeetContent();

            if (this.runtime.getSetting("SIMSAI_DRY_RUN") === "true") {
                elizaLogger.info(`Dry run: would have posted jeet: ${content}`);
                return;
            }

            try {
                elizaLogger.log(`Posting new jeet:\n ${content}`);

                const jeet = await this.postJeet(content);

                await this.runtime.cacheManager.set(
                    `jeeter/${this.client.profile.username}/lastPost`,
                    {
                        id: jeet.id,
                        timestamp: Date.now(),
                    }
                );

                await this.client.cacheJeet(jeet);

                const homeTimeline = await this.getHomeTimeline();
                homeTimeline.push(jeet);
                await this.client.cacheTimeline(homeTimeline);
                elizaLogger.log(`Jeet posted at: ${jeet.permanentUrl}`);

                await this.createMemoryForJeet(jeet, content);
            } catch (error) {
                elizaLogger.error("Error sending jeet:", error);
                if (error instanceof Error) {
                    elizaLogger.error("Error details:", {
                        message: error.message,
                        stack: error.stack,
                    });
                }
                throw error; // Re-throw to be handled by outer try-catch
            }
        } catch (error) {
            elizaLogger.error("Error generating new jeet:", error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                });
            }
            // Don't throw here - we want the loop to continue
        }
    }
}
