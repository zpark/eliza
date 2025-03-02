import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { Job, Worker } from "bullmq";
import { Redis } from "ioredis";
import { handleBuySignal } from "./buyService";
import { handleSellSignal } from "./sellService";
import { SonarClient } from "./sonarClient";
import { getWalletBalance } from "../utils/wallet";
import { DataLayer } from "./dataLayer";
import { WorkerPool } from "./workerpool";
import { BuySignalMessage } from "../types";

export class TradeWorker {
  private worker: Worker;
  private runtime: IAgentRuntime;
  private sonarClient: SonarClient;
  private workerPool: WorkerPool;

  constructor(queueName: string, connection: Redis, runtime: IAgentRuntime, sonarClient: SonarClient, workerPool: WorkerPool) {
    this.runtime = runtime;
    this.sonarClient = sonarClient;
    this.workerPool = workerPool;

    elizaLogger.info('Initializing trade worker for queue:', queueName);

    this.worker = new Worker(
      queueName,
      async (job: Job) => {
        elizaLogger.info(`Worker received job:`, {
          id: job.id,
          name: job.name,
          data: job.data
        });

        switch (job.name) {
          case "EXECUTE_BUY":
            return this.processBuyJob(job);
          case "EXECUTE_SELL":
            return this.processSellJob(job);
          case "GENERATE_BUY_SIGNAL":
            return this.generateBuySignal(job);
          case "SYNC_WALLET":
            return this.syncWallet(job);
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      },
      {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 1000 }
      }
    );

    this.setupWorkerEvents();
    elizaLogger.info('Trade worker initialized and listening for jobs');
  }

  private setupWorkerEvents() {
    this.worker.on('completed', (job) => {
      elizaLogger.info(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      elizaLogger.error(`Job ${job?.id} failed:`, error);
    });
  }

  private async processBuyJob(job: Job) {
    elizaLogger.info('Worker processing buy job:', {
      jobId: job.id,
      data: job.data
    });

    const result = await handleBuySignal(job.data, this.runtime);
    if (!result.success) {
      throw new Error('Buy operation failed');
    }

    elizaLogger.info('Worker completed buy job:', {
      jobId: job.id,
      result
    });

    return result;
  }

  private async processSellJob(job: Job) {
    const signal = job.data;

    // Validate amounts before executing sell
    if (!signal.amount || Number(signal.amount) <= 0) {
      elizaLogger.warn('Invalid sell amount:', {
        amount: signal.amount,
        currentBalance: signal.currentBalance
      });
      return { success: false, error: 'Invalid sell amount' };
    }

    // Verify we have enough balance
    if (Number(signal.amount) > Number(signal.currentBalance)) {
      elizaLogger.warn('Insufficient balance for sell:', {
        sellAmount: signal.amount,
        currentBalance: signal.currentBalance
      });
      return { success: false, error: 'Insufficient balance' };
    }

    const result = await handleSellSignal(signal, this.runtime, this.sonarClient);
    if (!result.success) {
      throw new Error('Sell failed');
    }
    return result;
  }

  private async generateBuySignal(job: Job) {
    elizaLogger.info('Generating scheduled buy signal');

    try {
      const walletBalance = await getWalletBalance(this.runtime);
      if (walletBalance < 0.1) {
        elizaLogger.info('Insufficient balance for scheduled buy', { walletBalance });
        return { success: true };
      }

      // Get token recommendation from DataLayer
      const recommendation = await DataLayer.getTokenRecommendation();

      if (!recommendation) {
        elizaLogger.info('No token recommendation available');
        return { success: true };
      }

      // Use handleBuySignal directly like tradingService
      const buySignal: BuySignalMessage = {
        positionId: `sol-process-${Date.now()}`,
        tokenAddress: recommendation.recommend_buy_address,
        recommenderId: "default",
      };

      const result = await handleBuySignal(buySignal, this.runtime);
      elizaLogger.info('Scheduled buy signal processed:', result);
      return result;
    } catch (error) {
      elizaLogger.error('Failed to process scheduled buy signal:', error);
      throw error;
    }
  }

  private async syncWallet(job: Job) {
    elizaLogger.info('Syncing wallet');
    const balance = await getWalletBalance(this.runtime);
    elizaLogger.info('Wallet synced:', { balance });
    return { success: true };
  }

  async close() {
    await this.worker.close();
  }
}