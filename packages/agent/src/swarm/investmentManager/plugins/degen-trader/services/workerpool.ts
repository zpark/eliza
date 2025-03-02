import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { BuySignalMessage, SellSignalMessage } from "../types";

export class WorkerPool {
  private queue: Queue;
  private runtime: IAgentRuntime;

  constructor(queueName: string, connection: Redis, runtime: IAgentRuntime) {
    this.queue = new Queue(queueName, { connection });
    this.runtime = runtime;

    this.queue.on("error", (error: Error) => {
      elizaLogger.error("Queue error:", error);
    });
  }

  async addBuyTask(data: BuySignalMessage) {
    return this.queue.add(
      "EXECUTE_BUY",
      data,
      {
        jobId: `buy-${data.tokenAddress}-${Date.now()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    );
  }

  async addSellTask(data: SellSignalMessage) {
    return this.queue.add(
      "EXECUTE_SELL",
      data,
      {
        jobId: `sell-${data.tokenAddress}-${Date.now()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    );
  }

  async clearQueue() {
    await this.queue.obliterate({ force: true });
  }
}