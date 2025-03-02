import { IAgentRuntime, UUID } from "@elizaos/core";

import Birdeye from "./providers/birdeye";
import CoinmarketCap from "./providers/coinmarketcap";
import Twitter from "./providers/twitter";
import TwitterParser from "./providers/twitter-parser";
import BuySignal from "./providers/buy-signal";

export const registerTasks = async (runtime: IAgentRuntime, worldId?: UUID) => {
	// TODO: thinking ahead, we should get the server ID from the server we are running in
	if(!worldId) {
		console.warn("**** HEY! You still need to pass in a worldId to register tasks");
		worldId = runtime.agentId;
	}

	runtime.registerTaskHandler({
		name: "BIRDEYE_SYNC_TRENDING",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncTrendingTokens("solana");
		}
	});

	runtime.createTask({
		name: "BIRDEYE_SYNC_TRENDING",
		description: "Sync trending tokens from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 60, // 1 hour
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskHandler({	
		name: "COINMARKETCAP_SYNC",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const cmc = new CoinmarketCap(runtime);
			await cmc.syncTokens();
		}
	});

	runtime.createTask({
		name: "COINMARKETCAP_SYNC",
		description: "Sync tokens from Coinmarketcap",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskHandler({
		name: "SYNC_RAW_TWEETS",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const twitter = new Twitter(runtime);
			await twitter.syncRawTweets();
		}
	});

	runtime.createTask({
		name: "SYNC_RAW_TWEETS",
		description: "Sync raw tweets from Twitter",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 15, // 15 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskHandler({
		name: "SYNC_WALLET",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncWallet();
		}
	});

	runtime.createTask({
		name: "SYNC_WALLET",
		description: "Sync wallet from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskHandler({
		name: "GENERATE_BUY_SIGNAL",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const signal = new BuySignal(runtime);
			await signal.generateSignal();
		}
	});

	runtime.createTask({
		name: "GENERATE_BUY_SIGNAL",
		description: "Generate a buy signal",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue"],
	});

	runtime.registerTaskHandler({
		name: "PARSE_TWEETS",
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, options) => {
			const twitterParser = new TwitterParser(runtime);
			await twitterParser.parseTweets();
		}
	});

	runtime.createTask({
		name: "PARSE_TWEETS",
		description: "Parse tweets",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 60 * 24, // 24 hours
		},
		tags: ["queue"],
	});
};