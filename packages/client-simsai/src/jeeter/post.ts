import { Jeet } from "./types";
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
            const lastPost = await this.runtime.cacheManager.get<{
                timestamp: number;
            }>(`jeeter/${this.client.profile.username}/lastPost`);

            const lastPostTimestamp = lastPost?.timestamp ?? 0;
            const minMinutes =
                parseInt(this.runtime.getSetting("POST_INTERVAL_MIN")) || 90;
            const maxMinutes =
                parseInt(this.runtime.getSetting("POST_INTERVAL_MAX")) || 180;
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

            elizaLogger.log(`Next jeet scheduled in ${randomMinutes} minutes`);
        };

        if (postImmediately) {
            await this.generateNewJeet();
        }

        generateNewJeetLoop();
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

            let homeTimeline: Jeet[] = [];

            const cachedTimeline = await this.client.getCachedTimeline();

            if (cachedTimeline) {
                homeTimeline = cachedTimeline;
            } else {
                homeTimeline = await this.client.fetchHomeTimeline(50);
                await this.client.cacheTimeline(homeTimeline);
            }

            const formattedHomeTimeline =
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
                    .join("\n");

            const topics = this.runtime.character.topics.join(", ");

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
            const content = truncateToCompleteSentence(
                formattedJeet,
                MAX_JEET_LENGTH
            );

            if (this.runtime.getSetting("SIMSAI_DRY_RUN") === "true") {
                elizaLogger.info(`Dry run: would have posted jeet: ${content}`);
                return;
            }

            try {
                elizaLogger.log(`Posting new jeet:\n ${content}`);

                const result = await this.client.requestQueue.add(
                    async () => await this.client.simsAIClient.postJeet(content)
                );

                if (!result?.id) {
                    elizaLogger.error(
                        "Failed to get valid response from postJeet:",
                        result
                    );
                    return;
                }

                elizaLogger.log(`Jeet posted with ID: ${result.id}`);

                // If we got a valid result with an ID, construct the jeet
                const jeet: Jeet = {
                    id: result.id,
                    text: content,
                    createdAt: result.createdAt || new Date().toISOString(),
                    agentId: this.client.profile.id,
                    agent: {
                        id: this.client.profile.id,
                        name: this.runtime.character.name,
                        username: this.client.profile.username,
                        type: "ai",
                        avatar_url: "", // Add if available
                    },
                    permanentUrl: `${JEETER_API_URL}/${this.client.profile.username}/status/${result.id}`,
                    public_metrics: {
                        reply_count: 0,
                        like_count: 0,
                        quote_count: 0,
                        rejeet_count: 0,
                    },
                    hashtags: [],
                    mentions: [],
                    photos: [],
                    thread: [],
                    urls: [],
                    videos: [],
                    media: [],
                };

                await this.runtime.cacheManager.set(
                    `jeeter/${this.client.profile.username}/lastPost`,
                    {
                        id: jeet.id,
                        timestamp: Date.now(),
                    }
                );

                await this.client.cacheJeet(jeet);

                homeTimeline.push(jeet);
                await this.client.cacheTimeline(homeTimeline);
                elizaLogger.log(`Jeet posted at: ${jeet.permanentUrl}`);

                const roomId = stringToUuid(
                    jeet.id + "-" + this.runtime.agentId
                );

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
            } catch (error) {
                elizaLogger.error("Error sending jeet:", error);
            }
        } catch (error) {
            elizaLogger.error("Error generating new jeet:", error);
        }
    }
}
