// src/plugin-twitter/src/actions/post.ts
import {
    type Action,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateText,
    logger
} from "@elizaos/core";
import { OnboardingState } from "../../shared/onboarding/types";
import { getUserServerRole } from "../../shared/role/types";

const tweetGenerationTemplate = `# Task: Generate a tweet in the style and voice of {{agentName}}.

About {{agentName}}:
{{bio}}
{{topics}}

{{characterPostExamples}}

Recent Context:
{{recentMessages}}

# Instructions: Write a tweet that captures the essence of what {{agentName}} wants to share. The tweet should be:
- Under {{maxTweetLength}} characters
- In {{agentName}}'s authentic voice and style
- Related to the ongoing conversation or context
- Not include hashtags unless specifically requested
- Natural and conversational in tone

Return only the tweet text, no additional commentary.`;

const twitterPostAction: Action = {
    name: "TWITTER_POST",
    similes: [
        "POST_TWEET",
        "SHARE_TWEET",
        "TWEET_THIS",
        "TWEET_ABOUT",
        "TWEET_IDEA",
        "POST_ON_TWITTER",
        "SHARE_ON_TWITTER"
    ],
    description: "Creates and posts a tweet based on the conversation context",
    
    validate: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<boolean> => {
        const serverId = state.serverId as string;
        if (!serverId) {
            return false;
        }

        const manager = (runtime.getClient("twitter") as any).getInstance();
        const client = manager.getClient(serverId, runtime.agentId);
        
        // If no client exists yet, check if we can create one from settings
        if (!client) {
            const onboardingState = await runtime.cacheManager.get(`server_${serverId}_onboarding_state`) as OnboardingState;
            if (!onboardingState?.settings) {
                return false;
            }

            // Check if Twitter is enabled and configured
            const settings = onboardingState.settings;
            if (!(settings.ENABLED_PLATFORMS?.value as string)?.toLowerCase().includes('twitter')) {
                return false;
            }

            try {
                // Try to create client with onboarding settings
                await manager.createClient(runtime, serverId, settings);
                return true;
            } catch (error) {
                logger.error("Failed to create Twitter client:", error);
                return false;
            }
        }

        return true;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ) => {
        try {
            const serverId = state.serverId as string;
            
            // Get onboarding state
            const onboardingState = await runtime.cacheManager.get(`server_${serverId}_onboarding_state`) as OnboardingState;
            if (!onboardingState?.settings) {
                throw new Error("Twitter not configured for this server");
            }

            // Generate the tweet content
            const context = composeContext({
                state: {
                    ...state,
                    maxTweetLength: 280
                },
                template: tweetGenerationTemplate
            });

            const tweetContent = await generateText({
                runtime,
                context,
                modelClass: ModelClass.TEXT_SMALL
            });

            // Clean up the generated content
            const cleanTweet = tweetContent
                .trim()
                .replace(/^["'](.*)["']$/, '$1')
                .replace(/\\n/g, '\n');

            // Prepare response content
            const responseContent: Content = {
                text: `I'll tweet this:\n\n${cleanTweet}`,
                action: "TWITTER_POST",
                source: message.content.source,
            };

            // Get or create Twitter client
            const manager = (runtime.getClient("twitter") as any).getInstance();
            let client = manager.getClient(serverId, runtime.agentId);
            if (!client) {
                client = await manager.createClient(runtime, serverId, onboardingState.settings);
            }

            // Handle approval requirement
            const requiresApproval = onboardingState.settings.POST_APPROVAL_REQUIRED?.value === "yes";
            const approvalRole = (onboardingState.settings.POST_APPROVAL_ROLE?.value as string)?.toLowerCase();

            if (requiresApproval) {
                runtime.registerTask({
                    roomId: message.roomId,
                    name: "Confirm Twitter Post",
                    description: "Confirm the tweet to be posted.",
                    tags: ["TWITTER_POST", "AWAITING_CONFIRMATION"],
                    handler: async (runtime: IAgentRuntime) => {
                        const result = await client.client.twitterClient.sendTweet(cleanTweet);
                        
                        const tweetId = result.data?.create_tweet?.tweet_results?.result?.rest_id;
                        const tweetUrl = `https://twitter.com/${onboardingState.settings.TWITTER_USERNAME.value}/status/${tweetId}`;
                        
                        await callback({
                            ...responseContent,
                            text: `Tweet posted!\n${tweetUrl}`,
                            url: tweetUrl,
                            tweetId
                        });
                    },
                    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
                        // Check if user has required role
                        const userRole = await getUserServerRole(runtime, message.userId, serverId);
                        if (approvalRole === "admin") {
                            return userRole === "ADMIN";
                        }
                        return userRole === "ADMIN" || userRole === "BOSS";
                    }
                });

                responseContent.text += "\nWaiting for approval from ";
                responseContent.text += approvalRole === "admin" ? "an admin" : "an admin or boss";
            } else {
                // Post immediately if no approval required
                const result = await client.client.twitterClient.sendTweet(cleanTweet);
                const tweetId = result.data?.create_tweet?.tweet_results?.result?.rest_id;
                const tweetUrl = `https://twitter.com/${onboardingState.settings.TWITTER_USERNAME.value}/status/${tweetId}`;
                
                responseContent.text = `Tweet posted!\n${tweetUrl}`;
                responseContent.url = tweetUrl;
                responseContent.tweetId = tweetId;
            }

            await callback(responseContent);
            return responseContent;

        } catch (error) {
            logger.error("Error in TWITTER_POST action:", error);
            throw error;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "That's such a great point about neural networks! You should tweet that",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Good idea! I'll share that thought on Twitter",
                    action: "TWITTER_POST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "You should share your thoughts about this on Twitter",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll post a tweet about it",
                    action: "TWITTER_POST",
                },
            },
        ]
    ]
};

export default twitterPostAction;