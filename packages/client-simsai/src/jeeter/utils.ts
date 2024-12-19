import { getEmbeddingZeroVector } from "@ai16z/eliza";
import { Content, Memory, UUID } from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { ClientBase } from "./base.ts";
import { elizaLogger } from "@ai16z/eliza";
import { SIMSAI_API_URL, MAX_JEET_LENGTH } from "./constants.ts";
import { Jeet } from "./types.ts";

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

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

export async function buildConversationThread(
    jeet: Jeet,
    client: ClientBase,
    maxReplies: number = 10
): Promise<Jeet[]> {
    const thread: Jeet[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentJeet: Jeet, depth: number = 0) {
        try {
            const memory = await client.runtime.messageManager.getMemoryById(
                stringToUuid(currentJeet.id + "-" + client.runtime.agentId)
            );

            if (!memory) {
                const roomId = stringToUuid(
                    (currentJeet.conversationId || currentJeet.id) +
                        "-" +
                        client.runtime.agentId
                );

                elizaLogger.log("Processing jeet:", {
                    id: currentJeet.id,
                    username: currentJeet.username,
                    text: currentJeet.text?.slice(0, 50),
                });

                if (!currentJeet.userId) {
                    elizaLogger.error(
                        "No userId found for jeet:",
                        currentJeet.id
                    );
                    return;
                }

                await client.runtime.ensureConnection(
                    stringToUuid(currentJeet.userId),
                    roomId,
                    currentJeet.username || "",
                    currentJeet.name || currentJeet.username || "",
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
                    userId: stringToUuid(currentJeet.userId),
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

            if (currentJeet.inReplyToStatusId) {
                elizaLogger.debug(
                    "Fetching parent jeet:",
                    currentJeet.inReplyToStatusId
                );

                try {
                    const parentJeet = await client.simsAIClient.getJeet(
                        currentJeet.inReplyToStatusId
                    );

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
                        timestamp: parentJeet.timestamp || Date.now() / 1000,
                        public_metrics: parentJeet.public_metrics || {
                            reply_count: 0,
                            like_count: 0,
                            quote_count: 0,
                            rejeet_count: 0,
                        },
                        conversationId:
                            parentJeet.conversationId || parentJeet.id || "",
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
                        jeetId: currentJeet.inReplyToStatusId,
                        error,
                    });
                }
            } else {
                elizaLogger.debug(
                    "Reached end of reply chain at:",
                    currentJeet.id
                );
            }
        } catch (error) {
            elizaLogger.error("Error in processThread:", {
                jeetId: currentJeet.id,
                error,
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

export function splitJeetContent(content: string): string[] {
    const maxLength = MAX_JEET_LENGTH;
    const paragraphs = content.split("\n\n").map((p) => p.trim());
    const jeets: string[] = [];
    let currentJeet = "";

    for (const paragraph of paragraphs) {
        if (!paragraph) continue;

        if ((currentJeet + "\n\n" + paragraph).trim().length <= maxLength) {
            if (currentJeet) {
                currentJeet += "\n\n" + paragraph;
            } else {
                currentJeet = paragraph;
            }
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

export function splitParagraph(paragraph: string, maxLength: number): string[] {
    const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [
        paragraph,
    ];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + " " + sentence).trim().length <= maxLength) {
            if (currentChunk) {
                currentChunk += " " + sentence;
            } else {
                currentChunk = sentence;
            }
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
                        if (currentChunk) {
                            currentChunk += " " + word;
                        } else {
                            currentChunk = word;
                        }
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
