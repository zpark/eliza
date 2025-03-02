// TODO: Set up registerTasks to actually register the tasks
// Should first obliterate any existing tasks with same tags for this agent

import { elizaLogger, IAgentRuntime, Service } from "@elizaos/core";
import { REQUIRED_SETTINGS } from "../config/config";
import { BuySignalMessage, SellSignalMessage } from "../types";
import { getWalletBalance } from "../utils/wallet";
import { handleBuySignal } from "./buyService";
import { DataLayer } from "./dataLayer";
import { handlePriceSignal } from "./priceService";
import { handleSellSignal } from "./sellService";
import { SonarClient } from "./sonarClient";

export class TradingService extends Service {
  private isRunning = false;
  private sonarClient: SonarClient;
  private processId: string;
  private runtime: IAgentRuntime;

  static serviceType: "trading";

  constructor() {
    super();
    //elizaLogger.info('Constructing trading service');
    this.processId = `sol-process-${Date.now()}`; // Generate unique process ID
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    //elizaLogger.info(`Initializing Degen Trader plugin service`);
    if (!runtime) {
      throw new Error("Runtime is required for degen trader plugin initialization");
    }
    this.runtime = runtime

    // Validate settings first
    //elizaLogger.info("Validating plugin settings...");

    const missingSettings = Object.entries(REQUIRED_SETTINGS)
      .filter(([key]) => !runtime.getSetting(key))
      .map(([key, desc]) => `${key} (${desc})`);

    if (missingSettings.length > 0) {
      const errorMsg = `Missing required settings: ${missingSettings.join(", ")}`;
      elizaLogger.error(errorMsg);
      throw new Error(errorMsg);
    }
    //elizaLogger.info("All required settings present");

    elizaLogger.success("Settings validated successfully");

    const apiKey = runtime.getSetting("SONAR_API_KEY");
    if (!apiKey) {
      throw new Error("SONAR_API_KEY setting is required");
    }

    this.sonarClient = new SonarClient(apiKey);
    //elizaLogger.info('Initializing trading service');
    try {
      // Connect to Sonar during initialization
      await this.sonarClient.connect();

      // Modify signal handlers to use worker pool
      this.sonarClient.onBuySignal(async (signal) => {
        elizaLogger.info('Adding buy signal to worker queue:', signal);
        const job = await this.addBuyTask(signal);
        elizaLogger.info('Buy job added to queue:', { jobId: job.id });
      });

      this.sonarClient.onSellSignal(async (signal) => {
        await this.addSellTask(signal);
      });

      this.sonarClient.onPriceSignal(async (signal) => {
        await handlePriceSignal(signal, this.runtime, this.sonarClient);
      });

      await this.registerTasks();

      elizaLogger.info('Trading service initialized and connected to Sonar', {
        processId: this.processId
      });

      // Automatically start the trading service after initialization
      elizaLogger.info('Auto-starting trading service...');
      await this.start();

    } catch (error) {
      elizaLogger.error('Failed to initialize trading service:', error);
      throw error;
    }
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

  // TODO: replace this with tasks and handlers
  async registerTasks() {
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

    // TODO: replace this with tasks and handlers
    // switch (job.name) {
    //   case "EXECUTE_BUY":
    //     return this.processBuyJob(job);
    //   case "EXECUTE_SELL":
    //     return this.processSellJob(job);
    //   case "GENERATE_BUY_SIGNAL":
    //     return this.generateBuySignal(job);
    //   case "SYNC_WALLET":
    //     return this.syncWallet(job);
    //   default:
    //     throw new Error(`Unknown job type: ${job.name}`);
    // }

    elizaLogger.info("Trade scheduler initialized successfully");
  }

  async start(): Promise<void> {
    elizaLogger.info('Starting trading service...');

    if (this.isRunning) {
      elizaLogger.warn('Trading service is already running');
      return;
    }

    try {
      elizaLogger.info('Setting isRunning flag to true');
      this.isRunning = true;

      // Get token recommendation from data layer
      const tokenData = await DataLayer.getTokenRecommendation();
      elizaLogger.info('Received token recommendation:', tokenData);

      // Get wallet's SOL balance using utility function
      elizaLogger.info('Fetching wallet balance...');
      const walletBalance = await getWalletBalance(this.runtime);
      elizaLogger.info('Wallet SOL balance:', { balance: walletBalance });

      // 1. Buy Token
      const buySignal = {
        tokenAddress: tokenData.recommend_buy_address,
        amount: walletBalance * 0.1,
        positionId: this.processId,
        recommenderId: "default"
      };
      elizaLogger.info('Preparing to execute buy signal:', buySignal);

      const buyResult = await handleBuySignal(buySignal, this.runtime);
      elizaLogger.info('Buy signal result:', {
        buyResult,
        quoteOutAmount: buyResult.outAmount,
        swapUsdValue: buyResult.swapUsdValue
      });

      // 2. Start Process
      elizaLogger.info('Starting Sonar process...');

      // Get price from Birdeye
      let initialPrice = "0";
      try {
        const response = await fetch(
          `https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenData.recommend_buy_address}`,
          {
            headers: {
              'X-API-KEY': this.runtime.getSetting("BIRDEYE_API_KEY") || '',
            }
          }
        );
        const data = await response.json();
        elizaLogger.info('Birdeye API response:', data);

        initialPrice = data?.data?.price?.toString() || "0";
      } catch (error) {
        elizaLogger.error('Failed to fetch price from Birdeye:', error);
      }

      // Debug buyResult
      elizaLogger.info('Buy result details:', {
        success: buyResult.success,
        outAmount: buyResult.outAmount,
        signature: buyResult.signature
      });

      const sonarProcessData = {
        id: this.processId,
        tokenAddress: tokenData.recommend_buy_address,
        balance: buyResult.outAmount?.toString() || "0",
        isSimulation: false,
        initialMarketCap: tokenData.marketcap.toString(),
        initialPrice,
        recommenderId: buyResult.recommenderId || "default",
        walletAddress: this.runtime.getSetting("SOLANA_PUBLIC_KEY"),
        txHash: buyResult.success ? buyResult.signature : `${this.processId}-init`,
      };

      elizaLogger.info('Sonar process data:', sonarProcessData);
      await this.sonarClient.startDegenProcess(sonarProcessData);
      elizaLogger.info('Sonar process started successfully');

    } catch (error) {
      elizaLogger.error('Failed to start trading service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    elizaLogger.info('Stopping trading service');
    try {
      // Stop the monitoring process
      await this.sonarClient.stopDegenProcess(this.processId);
      // Disconnect from WebSocket
      this.sonarClient.disconnect();
      this.isRunning = false;
      elizaLogger.info('Trading service stopped', { processId: this.processId });
    } catch (error) {
      elizaLogger.error('Error stopping trading service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}