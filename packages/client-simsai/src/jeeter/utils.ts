import { getEmbeddingZeroVector } from "@ai16z/eliza";
import { Content, Memory, UUID } from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { ClientBase } from "./base.ts";
import { elizaLogger } from "@ai16z/eliza";
import { SIMSAI_API_URL, MAX_JEET_LENGTH } from "./constants.ts";
import { Jeet } from "./types.ts";

/**
 * Waits for a random amount of time between the specified minimum and maximum duration.
 * @param minTime The minimum wait time in milliseconds (default: 1000).
 * @param maxTime The maximum wait time in milliseconds (default: 3000).
 * @returns A promise that resolves after the random wait time.
 */
export const wait = (
    minTime: number = 1000,
    maxTime: number = 3000
): Promise<void> => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

/**
 * Checks if a jeet is valid based on the number of hashtags, at mentions, and dollar signs.
 * @param jeet The jeet to validate.
 * @returns A boolean indicating whether the jeet is valid.
 */
export const isValidJeet = (jeet: Jeet): boolean => {
    const text = jeet.text || "";
    const hashtagCount = (text.match(/#/g) || []).length;
    const atCount = (text.match(/@/g) || []).length;
    const dollarSignCount = (text.match(/\$/g) || []).length;
    const totalCount = hashtagCount + atCount + dollarSignCount;

    return (
        hashtagCount <= 1 &&
        atCount <= 2 &&
        dollarSignCount <= 1 &&
        totalCount <= 3
    );
};

/**
 * Builds a conversation thread by recursively processing parent jeets.
 * @param jeet The starting jeet of the conversation thread.
 * @param client The ClientBase instance.
 * @returns A promise that resolves to an array of jeets representing the conversation thread.
 */
export async function buildConversationThread(
    jeet: Jeet,
    client: ClientBase
): Promise<Jeet[]> {
    const thread: Jeet[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentJeet: Jeet, depth: number = 0) {
        try {
            const jeetId = currentJeet.id;
            const agentId = client.runtime.agentId;

            if (typeof jeetId !== "string") {
                elizaLogger.error("Jeet ID is not a string:", jeetId);
                throw new TypeError("Jeet ID must be a string");
            }
            if (typeof agentId !== "string") {
                elizaLogger.error("Agent ID is not a string:", agentId);
                throw new TypeError("Agent ID must be a string");
            }

            const memory = await client.runtime.messageManager.getMemoryById(
                stringToUuid(jeetId + "-" + agentId)
            );

            if (!memory) {
                const conversationId =
                    currentJeet.conversationId || currentJeet.id;
                if (typeof conversationId !== "string") {
                    elizaLogger.error(
                        "Conversation ID is not a string:",
                        conversationId
                    );
                    throw new TypeError("Conversation ID must be a string");
                }

                const roomId = stringToUuid(
                    conversationId + "-" + client.runtime.agentId
                );

                elizaLogger.log("Processing jeet:", currentJeet.id);

                const userId = currentJeet.agentId;

                if (typeof userId !== "string" || !userId.trim()) {
                    elizaLogger.error(
                        "User ID is not a string or is empty:",
                        userId
                    );
                    throw new TypeError(
                        "User ID must be a string and cannot be empty"
                    );
                }

                await client.runtime.ensureConnection(
                    stringToUuid(userId),
                    roomId,
                    currentJeet.agent?.username || "",
                    currentJeet.agent?.name ||
                        currentJeet.agent?.username ||
                        "",
                    "jeeter"
                );

                await client.runtime.messageManager.createMemory({
                    id: stringToUuid(
                        currentJeet.id + "-" + client.runtime.agentId
                    ),
                    agentId: client.runtime.agentId,
                    content: {
                        text: currentJeet.text || "",
                        source: "jeeter",
                        url: currentJeet.permanentUrl,
                        inReplyTo: currentJeet.inReplyToStatusId
                            ? stringToUuid(
                                  currentJeet.inReplyToStatusId +
                                      "-" +
                                      client.runtime.agentId
                              )
                            : undefined,
                    },
                    createdAt: currentJeet.timestamp
                        ? Math.floor(currentJeet.timestamp * 1000)
                        : Date.now(),
                    roomId,
                    userId: stringToUuid(userId),
                    embedding: getEmbeddingZeroVector(),
                });
            }

            if (visited.has(currentJeet.id)) {
                elizaLogger.debug("Already visited jeet:", currentJeet.id);
                return;
            }

            visited.add(currentJeet.id);
            thread.unshift(currentJeet);

            elizaLogger.debug("Current thread state:", {
                length: thread.length,
                currentDepth: depth,
                jeetId: currentJeet.id,
            });

            const parentJeets = currentJeet.inReplyToStatusId
                ? [currentJeet.inReplyToStatusId]
                : [];

            await Promise.all(
                parentJeets.map(async (parentJeetId) => {
                    try {
                        const parentJeet =
                            await client.simsAIClient.getJeet(parentJeetId);

                        if (!parentJeet) {
                            elizaLogger.debug("No parent jeet found");
                            return;
                        }

                        const formattedParentJeet: Jeet = {
                            id: parentJeet.id || "",
                            text: parentJeet.text || "",
                            userId: parentJeet.agentId || "",
                            username: parentJeet.agent?.username || "",
                            name: parentJeet.agent?.name || "",
                            timestamp:
                                parentJeet.timestamp || Date.now() / 1000,
                            public_metrics: parentJeet.public_metrics || {
                                reply_count: 0,
                                like_count: 0,
                                quote_count: 0,
                                rejeet_count: 0,
                            },
                            conversationId:
                                parentJeet.conversationId ||
                                parentJeet.id ||
                                "",
                            mentions: parentJeet.mentions || [],
                            hashtags: parentJeet.hashtags || [],
                            photos: parentJeet.photos || [],
                            videos: parentJeet.videos || [],
                            thread: [],
                            urls: parentJeet.urls || [],
                            inReplyToStatusId: parentJeet.inReplyToStatusId,
                        };

                        elizaLogger.debug("Found parent jeet:", {
                            id: formattedParentJeet.id,
                            username: formattedParentJeet.username,
                            text: formattedParentJeet.text?.slice(0, 50),
                        });

                        await processThread(formattedParentJeet, depth + 1);
                    } catch (error) {
                        elizaLogger.error("Error processing parent jeet:", {
                            jeetId: parentJeetId,
                            error,
                        });
                    }
                })
            );
        } catch (error) {
            elizaLogger.error("Error in processThread:", {
                jeetId: currentJeet.id,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    await processThread(jeet, 0);

    elizaLogger.debug("Final thread built:", {
        totalJeets: thread.length,
        jeetIds: thread.map((t) => ({
            id: t.id,
            text: t.text?.slice(0, 50),
        })),
    });

    return thread;
}

/**
 * Sends a jeet by splitting the content into chunks and posting each chunk separately.
 * @param client The ClientBase instance.
 * @param content The content of the jeet.
 * @param roomId The room ID associated with the jeet.
 * @param jeetUsername The username of the user posting the jeet.
 * @param inReplyToJeetId The ID of the jeet being replied to (optional).
 * @returns A promise that resolves to an array of memory objects representing the sent jeets.
 */
export async function sendJeet(
    client: ClientBase,
    content: Content,
    roomId: UUID,
    jeetUsername: string,
    inReplyToJeetId?: string
): Promise<Memory[]> {
    const jeetChunks = splitJeetContent(content.text);
    const sentJeets: Jeet[] = [];

    for (const chunk of jeetChunks) {
        const result = await client.requestQueue.add(async () => {
            return await client.simsAIClient.postJeet(
                chunk.trim(),
                inReplyToJeetId
            );
        });

        const finalJeet: Jeet = {
            ...result,
            permanentUrl: `${SIMSAI_API_URL}/${jeetUsername}/status/${result.id}`,
        };

        sentJeets.push(finalJeet);
        inReplyToJeetId = finalJeet.id;
        await wait(1000, 2000);
    }

    const memories: Memory[] = sentJeets.map((jeet) => ({
        id: stringToUuid(jeet.id + "-" + client.runtime.agentId),
        agentId: client.runtime.agentId,
        userId: client.runtime.agentId,
        content: {
            text: jeet.text,
            source: "jeeter",
            url: jeet.permanentUrl,
            inReplyTo: inReplyToJeetId
                ? stringToUuid(inReplyToJeetId + "-" + client.runtime.agentId)
                : undefined,
        },
        roomId,
        embedding: getEmbeddingZeroVector(),
        createdAt: new Date(jeet.createdAt).getTime(),
    }));

    return memories;
}

/**
 * Splits the jeet content into chunks based on the maximum length.
 * @param content The content to split.
 * @returns An array of jeet chunks.
 */
export function splitJeetContent(content: string): string[] {
    const maxLength = MAX_JEET_LENGTH;
    const paragraphs = content.split("\n\n").map((p) => p.trim());
    const jeets: string[] = [];
    let currentJeet = "";

    for (const paragraph of paragraphs) {
        if (!paragraph) continue;

        if ((currentJeet + "\n\n" + paragraph).trim().length <= maxLength) {
            currentJeet = currentJeet
                ? currentJeet + "\n\n" + paragraph
                : paragraph;
        } else {
            if (currentJeet) {
                jeets.push(currentJeet.trim());
            }
            if (paragraph.length <= maxLength) {
                currentJeet = paragraph;
            } else {
                const chunks = splitParagraph(paragraph, maxLength);
                jeets.push(...chunks.slice(0, -1));
                currentJeet = chunks[chunks.length - 1];
            }
        }
    }

    if (currentJeet) {
        jeets.push(currentJeet.trim());
    }

    return jeets;
}

/**
 * Splits a paragraph into chunks based on the maximum length.
 * @param paragraph The paragraph to split.
 * @param maxLength The maximum length of each chunk.
 * @returns An array of paragraph chunks.
 */
export function splitParagraph(paragraph: string, maxLength: number): string[] {
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + " " + sentence).trim().length <= maxLength) {
            currentChunk = currentChunk
                ? currentChunk + " " + sentence
                : sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            if (sentence.length <= maxLength) {
                currentChunk = sentence;
            } else {
                const words = sentence.split(" ");
                currentChunk = "";
                for (const word of words) {
                    if (
                        (currentChunk + " " + word).trim().length <= maxLength
                    ) {
                        currentChunk = currentChunk
                            ? currentChunk + " " + word
                            : word;
                    } else {
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                        }
                        currentChunk = word;
                    }
                }
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Truncates the given text to the last complete sentence within the specified maximum length.
 * @param text The text to truncate.
 * @param maxLength The maximum length of the truncated text.
 * @returns The truncated text.
 */
export function truncateToCompleteSentence(
    text: string,
    maxLength: number
): string {
    if (text.length <= maxLength) {
        return text;
    }

    const truncatedAtPeriod = text.slice(
        0,
        text.lastIndexOf(".", maxLength) + 1
    );
    if (truncatedAtPeriod.trim().length > 0) {
        return truncatedAtPeriod.trim();
    }

    const truncatedAtSpace = text.slice(0, text.lastIndexOf(" ", maxLength));
    if (truncatedAtSpace.trim().length > 0) {
        return truncatedAtSpace.trim() + "...";
    }

    return text.slice(0, maxLength - 3).trim() + "...";
}
