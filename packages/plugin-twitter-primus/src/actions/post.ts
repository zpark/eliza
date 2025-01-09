import {
    Action,
    composeContext,
    elizaLogger,
    generateText,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import { ScraperWithPrimus } from "../util/ScraperWithPrimus.ts";
import { tweetProvider } from "../provider/tweetProvider.ts";
import { summarizeTweetTemplate } from "../templates.ts";

async function summaryTweetContent(
    runtime: IAgentRuntime,
    _message: Memory,
    twitterContent: string,
    state?: State
): Promise<string> {
    try {
        const context = summarizeTweetTemplate(twitterContent)

        const tweetContentStr = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });
        if (!tweetContentStr) {
            elizaLogger.error("Invalid tweet content:", tweetContentStr);
            return;
        }

        const trimmedContent = JSON.parse(tweetContentStr).text;

        // Skip truncation if TWITTER_PREMIUM is true
        if (
            process.env.TWITTER_PREMIUM?.toLowerCase() !== "true" &&
            trimmedContent.length > 200
        ) {
            elizaLogger.warn(
                `Tweet too long (${trimmedContent.length} chars), truncating...`
            );
            return trimmedContent.substring(0, 199) + "...";
        }

        return trimmedContent;
    } catch (error) {
        elizaLogger.error("Error composing tweet:", error);
        throw error;
    }
}

async function postTweet(content: string): Promise<boolean> {
    try {
        const scraperWithPrimus = new ScraperWithPrimus();
        await scraperWithPrimus.login();
        if (!(await scraperWithPrimus.getScraper().isLoggedIn())) {
            elizaLogger.error("Failed to login to Twitter");
            return false;
        }

        // Send the tweet
        elizaLogger.log("Attempting to send tweet:", content);
        const result = await scraperWithPrimus.sendTweet(content);

        elizaLogger.log("Tweet response:", result);

        // Check for Twitter API errors
        if (!result) {
            elizaLogger.error(`Twitter API error ${result}`);
            return false;
        }
        return true;
    } catch (error) {
        // Log the full error details
        elizaLogger.error("Error posting tweet:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause,
        });
        return false;
    }
}

export const postAction: Action = {
    description: "Post a tweet on Twitter and be verified by Primus",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get the latest tweet and post it on my twitter.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "The latest tweet has posted.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Help post a tweet which content from other tweet.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Completed!",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Post a tweet on twitter for me.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post the latest tweet to your Twitter account now!",
                    action: "POST_TWEET",
                },
            },
        ],
    ],
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<boolean> => {
        //check VERIFIABLE_INFERENCE_ENABLED
        if (
            !(
                process.env.VERIFIABLE_INFERENCE_ENABLED === "true" &&
                process.env.PRIMUS_APP_ID &&
                process.env.PRIMUS_APP_SECRET
            )
        ) {
            elizaLogger.error(
                `Parameter 'VERIFIABLE_INFERENCE_ENABLED' not set, Eliza will run this action!`
            );
            return false;
        }

        try {
            elizaLogger.log(`Eliza will run with plugin-twitter-primus!`);
            // Generate tweet content using context
            const twitterContent = await tweetProvider.get(
                runtime,
                message,
                state
            );

            if (!twitterContent) {
                elizaLogger.error("No content get from twitter");
                return false;
            }

            elizaLogger.log(`Content from twitter: ${twitterContent}`);

            //Summary the content
            const contentSummaryByAI = await summaryTweetContent(
                runtime,
                message,
                twitterContent,
                state
            );
            //log
            elizaLogger.log(
                `Summary content from twitter: ${contentSummaryByAI}`
            );
            // Check for dry run mode - explicitly check for string "true"
            if (
                process.env.TWITTER_DRY_RUN &&
                process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
            ) {
                elizaLogger.info(
                    `Dry run: would have posted tweet: ${contentSummaryByAI}`
                );
                return true;
            }

            return await postTweet(contentSummaryByAI);
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            return false;
        }
    },
    name: "POST_TWEET",
    similes: ["TWEET", "POST", "SEND_TWEET"],
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => {
        const hasCredentials =
            !!process.env.TWITTER_USERNAME && !!process.env.TWITTER_PASSWORD;
        elizaLogger.log(`Has credentials: ${hasCredentials}`);

        return hasCredentials;
    },
};
