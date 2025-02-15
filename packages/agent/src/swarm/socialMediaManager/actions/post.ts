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
import type { Message } from "discord.js";
import type { OnboardingState } from "../../shared/onboarding/types";
import { getUserServerRole } from "../../shared/role/types";

const tweetGenerationTemplate = `# Task: Create a post in the style and voice of {{agentName}}.
{{system}}

About {{agentName}}:
{{bio}}

{{topics}}

{{characterPostExamples}}

Recent Context:
{{recentMessages}}

# Instructions: Write a tweet that captures the essence of what {{agentName}} wants to share. The tweet should be:
- Under 280 characters
- In {{agentName}}'s authentic voice and style
- Related to the ongoing conversation or context
- Not include hashtags unless specifically requested
- Natural and conversational in tone

Return only the tweet text, no additional commentary.`;

// Required Twitter configuration fields that must be present
const REQUIRED_TWITTER_FIELDS = [
    'TWITTER_USERNAME',
    'TWITTER_EMAIL',
    'TWITTER_PASSWORD'
];

// Optional Twitter configuration fields
const OPTIONAL_TWITTER_FIELDS = [
    'TWITTER_2FA_SECRET',
    'POST_APPROVAL_REQUIRED',
    'POST_APPROVAL_ROLE'
];

/**
 * Validates that all required Twitter configuration fields are present and non-null
 */
async function validateTwitterConfig(runtime: IAgentRuntime, serverId: string): Promise<{isValid: boolean, error?: string}> {
    try {
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(`server_${serverId}_onboarding_state`);
        
        if (!onboardingState) {
            return {
                isValid: false,
                error: "No onboarding state found for this server"
            };
        }

        // Check required fields
        for (const field of REQUIRED_TWITTER_FIELDS) {
            if (!onboardingState[field] || onboardingState[field].value === null) {
                return {
                    isValid: false,
                    error: `Missing required Twitter configuration: ${field}`
                };
            }
        }

        return { isValid: true };
    } catch (error) {
        logger.error("Error validating Twitter config:", error);
        return {
            isValid: false,
            error: "Error validating Twitter configuration"
        };
    }
}

/**
 * Ensures a Twitter client exists for the given server and agent
 */
async function ensureTwitterClient(
    runtime: IAgentRuntime,
    serverId: string,
    onboardingState: OnboardingState
) {
    const manager = runtime.getClient("twitter");
    if (!manager) {
        throw new Error("Twitter client manager not found");
    }

    let client = manager.getClient(serverId, runtime.agentId);
    
    if (!client) {
        logger.info("Creating new Twitter client for server", serverId);
        client = await manager.createClient(runtime, serverId, onboardingState);
        if (!client) {
            throw new Error("Failed to create Twitter client");
        }
    }

    return client;
}

const twitterPostAction: Action = {
    name: "TWITTER_POST",
    similes: ["POST_TWEET", "SHARE_TWEET", "TWEET_THIS", "TWEET_ABOUT"],
    description: "Creates and posts a tweet based on the conversation context",
    
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {    
        if (!state?.discordMessage) {
            return false;
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return false;
        }
    
        const serverId = discordMessage.guild.id;
    
        // Check if there are any pending Twitter posts awaiting confirmation
        const pendingTasks = runtime.getTasks({
            roomId: message.roomId,
            tags: ["AWAITING_CONFIRMATION", "TWITTER_POST"],
        });
    
        if (pendingTasks && pendingTasks.length > 0) {
            return false;
        }
    
        // Validate Twitter configuration
        const validation = await validateTwitterConfig(runtime, serverId);
        if (!validation.isValid) {
            return false;
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
            if (!state?.discordMessage) {
                throw new Error("No discord message in state");
            }
            const discordMessage = state.discordMessage as Message;
            if (!discordMessage.guild?.id) {
                throw new Error("No guild ID in discord message");
            }

            const serverId = discordMessage.guild.id;
            
            // Get onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(`server_${serverId}_onboarding_state`);
            if (!onboardingState) {
                throw new Error("Twitter not configured for this server");
            }

            // Initialize/get Twitter client
            const client = await ensureTwitterClient(runtime, serverId, onboardingState);

            // Generate tweet content
            const context = composeContext({
                state,
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

            const userRole = await getUserServerRole(runtime, message.userId, serverId);
            if(!userRole) {
                // callback and return
                await callback({
                    text: "I'm sorry, but you're not authorized to post tweets on behalf of this org.",
                    action: "TWITTER_POST_FAILED",
                    source: message.content.source,
                });
                return;
            }

            // Prepare response content
            const responseContent: Content = {
                text: `I'll tweet this:\n\n${cleanTweet}`,
                action: "TWITTER_POST",
                source: message.content.source,
            };

                // Register approval task
                runtime.registerTask({
                    roomId: message.roomId,
                    name: "Confirm Twitter Post",
                    description: "Confirm the tweet to be posted.",
                    tags: ["TWITTER_POST", "AWAITING_CONFIRMATION"],
                    handler: async (runtime: IAgentRuntime) => {
                        // const response = await fetch(
                        //     'https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet',
                        //     {
                        //       headers,
                        //       body: JSON.stringify({
                        //         variables,
                        //         features: {
                        //           interactive_text_enabled: true,
                        //           longform_notetweets_inline_media_enabled: false,
                        //           responsive_web_text_conversations_enabled: false,
                        //           tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
                        //             false,
                        //           vibe_api_enabled: false,
                        //           rweb_lists_timeline_redesign_enabled: true,
                        //           responsive_web_graphql_exclude_directive_enabled: true,
                        //           verified_phone_label_enabled: false,
                        //           creator_subscriptions_tweet_preview_api_enabled: true,
                        //           responsive_web_graphql_timeline_navigation_enabled: true,
                        //           responsive_web_graphql_skip_user_profile_image_extensions_enabled:
                        //             false,
                        //           tweetypie_unmention_optimization_enabled: true,
                        //           responsive_web_edit_tweet_api_enabled: true,
                        //           graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
                        //           view_counts_everywhere_api_enabled: true,
                        //           longform_notetweets_consumption_enabled: true,
                        //           tweet_awards_web_tipping_enabled: false,
                        //           freedom_of_speech_not_reach_fetch_enabled: true,
                        //           standardized_nudges_misinfo: true,
                        //           longform_notetweets_rich_text_read_enabled: true,
                        //           responsive_web_enhance_cards_enabled: false,
                        //           subscriptions_verification_info_enabled: true,
                        //           subscriptions_verification_info_reason_enabled: true,
                        //           subscriptions_verification_info_verified_since_enabled: true,
                        //           super_follow_badge_privacy_enabled: false,
                        //           super_follow_exclusive_tweet_notifications_enabled: false,
                        //           super_follow_tweet_api_enabled: false,
                        //           super_follow_user_api_enabled: false,
                        //           android_graphql_skip_api_media_color_palette: false,
                        //           creator_subscriptions_subscription_count_enabled: false,
                        //           blue_business_profile_image_shape_enabled: false,
                        //           unified_cards_ad_metadata_container_dynamic_card_content_query_enabled:
                        //             false,
                        //           rweb_video_timestamps_enabled: false,
                        //           c9s_tweet_anatomy_moderator_badge_enabled: false,
                        //           responsive_web_twitter_article_tweet_consumption_enabled: false,
                        //         },
                        //         fieldToggles: {},
                        //       }),
                        //       method: 'POST',
                        //     },
                        //   );


                        const result = await client.client.twitterClient.sendTweet(cleanTweet);
                        // result is a response object, get the data from it-- body is a readable stream
                        const data = await result.json();
                        
                        const tweetId = data?.data?.create_tweet?.tweet_results?.result?.rest_id;

                        const tweetUrl = `https://twitter.com/${onboardingState.TWITTER_USERNAME.value}/status/${tweetId}`;
                        
                        await callback({
                            ...responseContent,
                            text: `Tweet posted!\n${tweetUrl}`,
                            url: tweetUrl,
                            tweetId
                        });
                    },
                    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
                        return userRole === "OWNER" || userRole === "ADMIN";
                    }
                });

                responseContent.text += "\nWaiting for approval from ";
                responseContent.text += userRole === "OWNER" ? "an admin" : "an admin or boss";

            await callback({...responseContent, action: "TWITTER_POST_WAITING_FOR_CONFIRM"});
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
                    text: "I'll tweet this:\n\nDeep learning isn't just about layers - it's about understanding how neural networks actually learn from patterns. The magic isn't in the math, it's in the emergent behaviors we're just beginning to understand.",
                    action: "TWITTER_POST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you share this insight on Twitter?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Tweet posted!\nhttps://twitter.com/username/status/123456789",
                    action: "TWITTER_POST",
                },
            },
        ]
    ]
};

export default twitterPostAction;