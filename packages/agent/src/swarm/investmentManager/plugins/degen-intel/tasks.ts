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

	runtime.registerTask({
		name: "BIRDEYE_SYNC_TRENDING",
		description: "Sync trending tokens from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 60, // 1 hour
		},
		tags: ["queue", "repeat"],
		validate: async (runtime, message, state) => {
			return true; // TODO: validate after certain time
		},
		handler: async (runtime, options) => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncTrendingTokens("solana");
		}
	});

	runtime.registerTask({
		name: "COINMARKETCAP_SYNC",
		description: "Sync tokens from Coinmarketcap",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
		handler: async () => {
			const cmc = new CoinmarketCap(runtime);
			await cmc.syncTokens();
		}
	});

	runtime.registerTask({
		name: "SYNC_RAW_TWEETS",
		description: "Sync raw tweets from Twitter",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 15, // 15 minutes
		},
		tags: ["queue", "repeat"],
		handler: async () => {
			const twitter = new Twitter(runtime);
			await twitter.syncRawTweets();
		}
	});

	runtime.registerTask({
		name: "SYNC_WALLET",
		description: "Sync wallet from Birdeye",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue", "repeat"],
		handler: async () => {
			const birdeye = new Birdeye(runtime);
			await birdeye.syncWallet();
		}
	});

	runtime.registerTask({
		name: "GENERATE_BUY_SIGNAL",
		description: "Generate a buy signal",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 5, // 5 minutes
		},
		tags: ["queue"],
		handler: async () => {
			const signal = new BuySignal(runtime);
			await signal.generateSignal();
		}
	});

	runtime.registerTask({
		name: "PARSE_TWEETS",
		description: "Parse tweets",
		worldId,
		metadata: {
			updatedAt: Date.now(),
			updateInterval: 1000 * 60 * 60 * 24, // 24 hours
		},
		tags: ["queue"],
		handler: async () => {
			const twitterParser = new TwitterParser(runtime);
			await twitterParser.parseTweets();
		}
	});
};