import type { IAgentRuntime, UUID } from "@elizaos/core";

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

	runtime.registerTaskWorker({
		name: "BIRDEYE_SYNC_TRENDING",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncTrendingTokens("solana");
		}
	});

	runtime.databaseAdapter.createTask({
		name: "BIRDEYE_SYNC_TRENDING",
		description: "Sync trending tokens from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 60, // 1 hour
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskWorker({	
		name: "COINMARKETCAP_SYNC",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const cmc = new CoinmarketCap(runtime);
			await cmc.syncTokens();
		}
	});

	runtime.databaseAdapter.createTask({
		name: "COINMARKETCAP_SYNC",
		description: "Sync tokens from Coinmarketcap",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskWorker({
		name: "SYNC_RAW_TWEETS",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const twitter = new Twitter(runtime);
			await twitter.syncRawTweets();
		}
	});

	runtime.databaseAdapter.createTask({
		name: "SYNC_RAW_TWEETS",
		description: "Sync raw tweets from Twitter",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 15, // 15 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskWorker({
		name: "SYNC_WALLET",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncWallet();
		}
	});

	runtime.databaseAdapter.createTask({
		name: "SYNC_WALLET",
		description: "Sync wallet from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
	});

	runtime.registerTaskWorker({
		name: "GENERATE_BUY_SIGNAL",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const signal = new BuySignal(runtime);
			await signal.generateSignal();
		}
	});

	runtime.databaseAdapter.createTask({
		name: "GENERATE_BUY_SIGNAL",
		description: "Generate a buy signal",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue"],
	});

	runtime.registerTaskWorker({
		name: "PARSE_TWEETS",
		validate: async (_runtime, _message, _state) => {
			return true; // TODO: validate after certain time
		},
		execute: async (runtime, _options) => {
			const twitterParser = new TwitterParser(runtime);
			await twitterParser.parseTweets();
		}
	});

	runtime.databaseAdapter.createTask({
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