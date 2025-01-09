import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {TwitterScraper} from "../util/twitterScraper.ts";

const tweetProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        const scraperWithPrimus = new TwitterScraper();
        elizaLogger.info("Login to Twitter");
        await scraperWithPrimus.login();
        elizaLogger.info("Login to Twitter success");

        if (!(await scraperWithPrimus.getScraper().isLoggedIn())) {
            elizaLogger.error("Failed to login to Twitter");
            return false;
        }
        const userName = process.env.TWITTER_USERNAME_WANT_TO_GET_TWEET;
        if(!userName){
            elizaLogger.error("TWITTER_USERNAME_WANT_TO_GET_TWEET is not set");
            return false;
        }
        const userId = await scraperWithPrimus.getUserIdByScreenName(userName);
        elizaLogger.log(`userName is:${userName}, userId:${userId}`);
        const result = await scraperWithPrimus.getUserLatestTweet(userId);
        //log
        elizaLogger.log("Tweet response:", result);
        return result;
    },
};

export { tweetProvider };
