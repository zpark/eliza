// eslint-disable-next-line
// @ts-nocheck
// src/actions/joinTwitterSpace
import {
    type Action,
    type ActionExample,
    composeContext,
    type IAgentRuntime,
    type Memory,
    type State,
    generateText,
    ModelClass,
    stringToUuid
} from "@elizaos/core";

export default {
    name: "JOIN_TWITTER_SPACE",
    similes: [
        "JOIN_TWITTER_SPACE",
        "JOIN_SPACE",
        "JOIN_TWITTER_AUDIO",
        "JOIN_TWITTER_CALL",
        "JOIN_LIVE_CONVERSATION",
    ],
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State
    ) => {
        if (message.content.source !== "twitter") {
            return false;
        }

        const spaceEnable = runtime.getSetting("TWITTER_SPACES_ENABLE") === true;
        return spaceEnable;
    },
    description: "Join a Twitter Space to participate in live audio conversations.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<boolean> => {
        if (!state) {
            console.error("State is not available.");
            return false;
        }

        for (const response of responses) {
            await callback(response.content);
        }
        
        const manager = runtime.getClient("twitter");
        if (!manager) {
            throw new Error("Twitter client manager not found");
        }

        const clientId = stringToUuid("default");
        const clientKey = manager.getClientKey(clientId, runtime.agentId)

        const client = manager.clients.get(clientKey).client;
        const spaceManager = manager.clients.get(clientKey).space;

        if (!spaceManager) {
            console.error("space action - no space manager found")
            return false;
        }

        const tweet = message.content.tweet;
        if (!tweet) {
            console.error("space action - no tweet found in message")
            return false;
        }


        async function joinSpaceByUrls(tweet: any): Promise<string | null> {
            if (tweet.urls) {
                for (const url of tweet.urls) {
                    const match = url.match(/https:\/\/x\.com\/i\/spaces\/([a-zA-Z0-9]+)/);
                    if (match) {
                        const spaceId = match[1];
                        const space = await client.twitterClient.getAudioSpaceById(spaceId);
                        if (space?.metadata?.state === 'Running') {
                            
                            try {
                                const space = await spaceManager.joinSpace(spaceId);
                                return !!space;
                            } catch(error) {
                                console.error(error)
                            }
                        }
                    }
                }
            }
            return false;
        }
        
        async function joinSpaceByUserName(userName: string) {
          const tweetGenerator = client.twitterClient.getTweets(userName);

          for await (const tweet of tweetGenerator) {
            const space = await joinSpaceByUrls(tweet);
            if (space) {
                return true;
            }
          }
        }

        // Attempt to join a Twitter Space from URLs found in the tweet
        await joinSpaceByUrls(tweet);
        
        // If no Space was found in the URLs, check if the tweet author has an active Space
        await joinSpaceByUserName(tweet.username);

        // If the tweet author isn't hosting a Space, check if any mentioned users are currently hosting one
        const agentName = client.state["TWITTER_USERNAME"];
        tweet.mentions.forEach(async (mention) => {
            if (mention.username !== agentName) {
                await joinSpaceByUserName(mention.username)
            }
        })

        await callback({
            text: "I couldn't determine which Twitter Space to join.",
            source: "twitter",
        });

        return false;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey, let's join the 'Crypto Talk' Twitter Space!",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "On my way",
                    action: "JOIN_TWITTER_SPACE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "@{{user2}}, jump into the 'AI Revolution' Space!",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Joining now!",
                    action: "JOIN_TWITTER_SPACE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;