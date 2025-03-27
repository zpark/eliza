import type { IAgentRuntime, UUID } from "@elizaos/core";

import Birdeye from "./providers/birdeye";
import CoinmarketCap from "./providers/coinmarketcap";
import Twitter from "./providers/twitter";
import TwitterParser from "./providers/twitter-parser";
import BuySignal from "./providers/buy-signal";
import SellSignal from "./providers/sell-signal";

export const registerTasks = async (runtime: IAgentRuntime, worldId?: UUID) => {
  worldId = runtime.agentId; // this is global data for the agent

  // first, get all tasks with tags "queue", "repeat", "degen_intel" and delete them
  const tasks = await runtime.databaseAdapter.getTasks({
    tags: ["queue", "repeat", "degen_intel"]
  });

  for (const task of tasks) {
    await runtime.databaseAdapter.deleteTask(task.id);
  }

  // only regsiter the Birdeye tasks if we have Birdeye key
  if (runtime.getSetting("BIRDEYE_API_KEY")) {
    console.log('registering INTEL_BIRDEYE_SYNC_TRENDING')
    runtime.registerTaskWorker({
      name: "INTEL_BIRDEYE_SYNC_TRENDING",
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options) => {
        const birdeye = new Birdeye(runtime);
        await birdeye.syncTrendingTokens("solana");
      }
    });

    runtime.databaseAdapter.createTask({
      name: "INTEL_BIRDEYE_SYNC_TRENDING",
      description: "Sync trending tokens from Birdeye",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 60, // 1 hour
      },
      tags: ["queue", "repeat", "degen_intel", "immediate"],
    });
  }

  // only regsiter the CMC tasks if we have CMC key
  if (runtime.getSetting("COINMARKETCAP_API_KEY")) {
    console.log('registering INTEL_COINMARKETCAP_SYNC')
    runtime.registerTaskWorker({
      name: "INTEL_COINMARKETCAP_SYNC",
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options) => {
        const cmc = new CoinmarketCap(runtime);
        await cmc.syncTokens();
      }
    });

    runtime.databaseAdapter.createTask({
      name: "INTEL_COINMARKETCAP_SYNC",
      description: "Sync tokens from Coinmarketcap",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ["queue", "repeat", "degen_intel", "immediate"],
    });
  }

  if (runtime.getSetting("TWITTER_USERNAME")) {
    console.log('registering INTEL_SYNC_RAW_TWEETS')
    runtime.registerTaskWorker({
      name: "INTEL_SYNC_RAW_TWEETS",
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options) => {
        console.log('executing twitter set up and running syncRawTweets')
        const twitter = new Twitter(runtime);
        await twitter.syncRawTweets();
      }
    });

    runtime.databaseAdapter.createTask({
      name: "INTEL_SYNC_RAW_TWEETS",
      description: "Sync raw tweets from Twitter",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 15, // 15 minutes
      },
      tags: ["queue", "repeat", "degen_intel", "immediate"],
    });
  }

  // only regsiter the Birdeye tasks if we have Birdeye key
  if (runtime.getSetting("BIRDEYE_API_KEY")) {
    console.log('registering INTEL_SYNC_WALLET')
    runtime.registerTaskWorker({
      name: "INTEL_SYNC_WALLET",
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options) => {
        const birdeye = new Birdeye(runtime);
        await birdeye.syncWallet();
      }
    });

    runtime.databaseAdapter.createTask({
      name: "INTEL_SYNC_WALLET",
      description: "Sync wallet from Birdeye",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ["queue", "repeat", "degen_intel", "immediate"],
    });
  }

  runtime.registerTaskWorker({
    name: "INTEL_GENERATE_BUY_SIGNAL",
    validate: async (_runtime, _message, _state) => {
      return true; // TODO: validate after certain time
    },
    execute: async (runtime, _options) => {
      const signal = new BuySignal(runtime);
      await signal.generateSignal();
    }
  });

  runtime.databaseAdapter.createTask({
    name: "INTEL_GENERATE_BUY_SIGNAL",
    description: "Generate a buy signal",
    worldId,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // FIXME: env var
      updateInterval: 1000 * 60 * 5, // 5 minutes
    },
    tags: ["queue", "repeat", "degen_intel", "immediate"],
  });

  // enable with solana wallet env vars set
  runtime.registerTaskWorker({
    name: "INTEL_GENERATE_SELL_SIGNAL",
    validate: async (_runtime, _message, _state) => {
      return true; // TODO: validate after certain time
    },
    execute: async (runtime, _options) => {
      const signal = new SellSignal(runtime);
      await signal.generateSignal();
    }
  });

  runtime.databaseAdapter.createTask({
    name: "INTEL_GENERATE_SELL_SIGNAL",
    description: "Generate a sell signal",
    worldId,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // FIXME: env var
      updateInterval: 1000 * 60 * 10, // 5 minutes
    },
    tags: ["queue", "repeat", "degen_intel", "immediate"],
  });


  if (runtime.getSetting("TWITTER_USERNAME")) {
    console.log('registering INTEL_PARSE_TWEETS')
    runtime.registerTaskWorker({
      name: "INTEL_PARSE_TWEETS",
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options) => {
        const twitterParser = new TwitterParser(runtime);
        await twitterParser.parseTweets();
      }
    });

    runtime.databaseAdapter.createTask({
      name: "INTEL_PARSE_TWEETS",
      description: "Parse tweets",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 60 * 24, // 24 hours
      },
      tags: ["queue", "repeat", "degen_intel", "immediate"],
    });
  }
};