// TODO: Replace with task handling queue

import { elizaLogger } from "@elizaos/core";
import { IAgentRuntime } from "@elizaos/core";

export class TradeScheduler {
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.queue = new Queue(queueName, { connection });
    this.runtime = runtime;

    this.queue.on("error", (error: Error) => {
      elizaLogger.error("Scheduler queue error:", error);
    });
  }

  async initialize() {
    elizaLogger.info("Initializing trade scheduler...");

    // Clear existing schedules
    await this.queue.obliterate({ force: true });

    // Schedule buy signal generation every 10 minutes
    await this.queue.add(
      "GENERATE_BUY_SIGNAL",
      {},
      {
        jobId: "scheduled-buy-signal",
        repeat: {
          pattern: "*/10 * * * *" // Every 10 minutes
        }
      }
    );

    // Optional: Add wallet sync schedule
    await this.queue.add(
      "SYNC_WALLET",
      {},
      {
        jobId: "wallet-sync",
        repeat: {
          pattern: "*/10 * * * *"
        }
      }
    );

    elizaLogger.info("Trade scheduler initialized successfully");
  }

  async stop() {
    elizaLogger.info("Stopping trade scheduler...");
    await this.queue.close();
  }
}