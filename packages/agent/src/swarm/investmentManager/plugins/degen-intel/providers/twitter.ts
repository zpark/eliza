// todo: replace Client reference with client reference
// Set up cache adapter for loading cookies
// This action should be able to run on a schedule
// store tweets as memories in db, no reason really to get twitter here

import type { IRawTweet } from "../types";
import { IAgentRuntime, logger } from "@elizaos/core";

export default class Twitter {
	runtime: IAgentRuntime;

	constructor(runtime: IAgentRuntime) {
		this.runtime = runtime;
	}

	async syncRawTweets(): Promise<boolean> {
		const username = this.runtime.getSetting("TWITTER_USERNAME");

		// get the twitterClient from runtime
		const twitterClient = this.runtime.getClient("twitter").client;

		const list = twitterClient.getTweets(username as string, 200);
		const ops = [];
		for await (const item of list) {
			if (item?.text && !item?.isRetweet) {
				const data: IRawTweet = {
					id: item.id,
					timestamp: new Date(item.timestamp * 1000),
					text: item.text,
					username: item.username,
					likes: item.likes ?? 0,
					retweets: item.retweets ?? 0,
				};

				ops.push({
					updateOne: {
						filter: {
							id: data.id,
						},
						update: {
							$set: data,
						},
						upsert: true,
					},
				});
			}
		}

		const writeResult = await DB.RawTweet.bulkWrite(ops);

		logger.info(writeResult, `Raw tweet sync [username: ${username}] resulted in:`);

		/** Sleep 10 seconds */
		await new Promise(resolve => setTimeout(resolve, 10_000));

		return true;
	}
}
