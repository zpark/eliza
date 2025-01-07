import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {ScraperWithPrimus} from "../util/ScraperWithPrimus.ts";

const tweetProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        const scraperWithPrimus = new ScraperWithPrimus();
        elizaLogger.info("Login to Twitter")
        await scraperWithPrimus.login()
        elizaLogger.info("Login to Twitter success")

        if (!(await scraperWithPrimus.getScraper().isLoggedIn())) {
            elizaLogger.error("Failed to login to Twitter");
            return false;
        }
        const userId = process.env.TWITTER_USER_ID_WANT_TO_GET_TWEET;
        if(!userId){
            elizaLogger.error("TWITTER_USER_ID_WANT_TO_GET_TWEET is not set");
            return false;
        }

        const result = await scraperWithPrimus.getUserLatestTweet(userId);
        //log
        elizaLogger.log("Tweet response:", result);
        return result;
    },
};

export { tweetProvider };
