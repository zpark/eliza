// Combined DegenTradingService that integrates all functionality

import { composeContext, type Content, type IAgentRuntime, logger, type Memory, ModelTypes, parseJSONObjectFromText, Service, type UUID } from "@elizaos/core";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { REQUIRED_SETTINGS } from "./config/config";
import { BuySignalMessage, PriceSignalMessage, SellSignalMessage, ServiceTypes } from "./types";
import { tradeAnalysisTemplate } from "./utils/analyzeTrade";
import { executeTrade, getWalletBalance, getWalletKeypair } from "./utils/wallet";

export class DegenTradingService extends Service {
  private isRunning = false;
  private processId: string;
  
  // For tracking pending sells
  private pendingSells: { [tokenAddress: string]: bigint } = {};

  static serviceType = "degen_trading";

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
    this.processId = `sol-process-${Date.now()}`;
  }

  static async start(runtime: IAgentRuntime): Promise<DegenTradingService> {
    if (!runtime) {
      throw new Error("Runtime is required for degen trader plugin initialization");
    }
    const service = new DegenTradingService(runtime);

    // Validate settings first
    const missingSettings = Object.entries(REQUIRED_SETTINGS)
      .filter(([key]) => !runtime.getSetting(key))
      .map(([key, desc]) => `${key} (${desc})`);

    if (missingSettings.length > 0) {
      const errorMsg = `Missing required settings: ${missingSettings.join(", ")}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.success("Settings validated successfully");

    try {
      // Register tasks
      await service.registerTasks();

      logger.info('Trading service initialized successfully', {
        processId: service.processId
      });

      // Automatically start the trading service after initialization
      logger.info('Auto-starting trading service...');
      await service.start();

    } catch (error) {
      logger.error('Failed to initialize trading service:', error);
      throw error;
    }

    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(ServiceTypes.DEGEN_TRADING);
    if (service) {
      await service.stop();
    }
  }

  /**
   * Handle signals for buy, sell, and price updates
   */
  handleBuySignalEvent = async (signal: BuySignalMessage) => {
    logger.info('Buy signal received:', signal);
    await this.createBuyTask(signal);
  }

  handleSellSignalEvent = async (signal: SellSignalMessage) => {
    logger.info('Sell signal received:', signal);
    await this.createSellTask(signal);
  }

  handlePriceSignalEvent = async (signal: PriceSignalMessage) => {
    logger.info('Price signal received:', signal);
    await this.handlePriceSignal(signal);
  }

  //
  // DATA LAYER FUNCTIONALITY
  //

  /**
   * Gets token recommendation (stubbed for now)
   */
  async getTokenRecommendation(): Promise<{
    recommended_buy: string;
    recommend_buy_address: string;
    reason: string;
    marketcap: number;
    buy_amount: number;
  }> {
    try {
      // Stub implementation - in a real world scenario, this would call an API
      logger.info('Getting token recommendation');
      
      // Mock data for testing
      const mockData = {
        recommended_buy: "Sample Token",
        recommend_buy_address: "So11111111111111111111111111111111111111112", // Using SOL as example
        reason: "Strong market indicators and positive sentiment",
        marketcap: 5000000,
        buy_amount: 0.1
      };
      
      logger.info('Received token recommendation:', mockData);
      return mockData;
    } catch (error) {
      logger.error('Failed to fetch token recommendation:', error);
      throw error;
    }
  }

  //
  // PRICE SERVICE FUNCTIONALITY
  //

  /**
   * Handles price update signals
   */
  async handlePriceSignal(signal: PriceSignalMessage): Promise<void> {
    logger.info('Price update received:', {
      token: signal.tokenAddress,
      initialPrice: signal.initialPrice,
      currentPrice: signal.currentPrice,
      priceChange: `${signal.priceChange}%`
    });
    
    // Store price update in cache or state if needed
    await this.runtime.databaseAdapter.setCache<any>(`price:${signal.tokenAddress}`, {
      initialPrice: signal.initialPrice,
      currentPrice: signal.currentPrice,
      priceChange: signal.priceChange,
      timestamp: new Date().toISOString()
    });
  }

  //
  // BUY SERVICE FUNCTIONALITY
  //

  /**
   * Analyzes the optimal trading amount
   */
  private async analyzeTradingAmount({
    walletBalance,
    tokenAddress,
    defaultPercentage = 0.1
  }: {
    walletBalance: number;
    tokenAddress: string;
    defaultPercentage?: number;
  }): Promise<number> {
    try {
      // Log input parameters
      logger.info('Starting trade analysis with:', {
        walletBalance,
        tokenAddress,
        defaultPercentage
      });

      // Fetch token recommendation
      const tokenRecommendation = await this.getTokenRecommendation();

      const context = composeContext({
        template: tradeAnalysisTemplate,
        state: {
          bio: "",
          lore: "",
          messageDirections: "",
          postDirections: "",
          replyDirections: "",
          systemDirections: "",
          userDirections: "",
          roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`,
          actors: JSON.stringify(["trader"]),
          recentMessages: JSON.stringify([""]),
          recentMessagesData: [],
          walletBalance: walletBalance.toString(),
          api_data: JSON.stringify({  // Format the API data nicely
            recommended_buy: tokenRecommendation.recommended_buy,
            recommend_buy_address: tokenRecommendation.recommend_buy_address,
            reason: tokenRecommendation.reason,
            buy_amount: tokenRecommendation.buy_amount,
            marketcap: tokenRecommendation.marketcap
          }, null, 2)  // Pretty print with 2 spaces indentation
        }
      });

      // Log context
      logger.info('Generated context:', { context });

      // Generate analysis
      const content = await this.runtime.useModel(ModelTypes.TEXT_LARGE, {
        context,
      });

      // Log generated content
      logger.info('Generated analysis content:', { content });

      if (!content) {
        logger.warn('No analysis generated, using default percentage');
        return walletBalance * defaultPercentage;
      }

      // Log parsed recommendation
      const recommendation = parseJSONObjectFromText(content);
      logger.info('Parsed recommendation:', { recommendation });

      const suggestedAmount = recommendation.suggestedAmount || walletBalance * defaultPercentage;
      logger.info('Final suggested amount:', { suggestedAmount });

      return Math.min(suggestedAmount, walletBalance);
    } catch (error) {
      logger.error('Trade analysis failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return walletBalance * defaultPercentage;
    }
  }

  /**
   * Handles buy signal processing
   */
  async handleBuySignal(
    signal: BuySignalMessage
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    outAmount?: string;
    swapUsdValue?: string;
    entityId?: string;
  }> {
    logger.info('Processing buy signal:', signal);

    const TRADER_KUMA = this.runtime.getSetting('TRADER_KUMA')
    if (TRADER_KUMA) {
      fetch(TRADER_KUMA).catch((e) => {
        console.error("TRADER_KUMA err", e);
      });
    }

    try {
      // Get current wallet balance
      const walletBalance = await getWalletBalance(this.runtime);
      logger.info('Current wallet balance:', { walletBalance });

      // Analyze and determine trade amount based on wallet balance
      const tradeAmount = await this.analyzeTradingAmount({
        walletBalance,
        tokenAddress: signal.tokenAddress,
        defaultPercentage: 0.1
      });

      // Add retry logic for quote
      let quoteData;
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          logger.info(`Attempting to get quote (attempt ${i + 1}):`, {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: signal.tokenAddress,
            amount: tradeAmount * 1e9,
            slippageBps: 4500
          });

          const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${signal.tokenAddress}&amount=${Math.round(tradeAmount * 1e9)}&slippageBps=4500`
          );

          if (!quoteResponse.ok) {
            const errorText = await quoteResponse.text();
            logger.error('Quote API error response:', {
              status: quoteResponse.status,
              statusText: quoteResponse.statusText,
            });
            throw new Error(`Quote API returned ${quoteResponse.status}: ${errorText}`);
          }

          quoteData = await quoteResponse.json();
          logger.info('Raw quote response:', quoteData);

          if (!quoteData.outAmount || !quoteData.routePlan) {
            throw new Error(`Invalid quote response: ${JSON.stringify(quoteData)}`);
          }

          logger.info('Quote received successfully:', quoteData);
          break;
        } catch (error) {
          logger.error(`Quote attempt ${i + 1} failed:`, {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
          });
          if (i === maxRetries - 1) {
            throw new Error(`Failed to get quote after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
        }
      }

      // Execute the trade
      const tradeResult = await executeTrade(this.runtime, {
        tokenAddress: signal.tokenAddress,
        amount: tradeAmount,
        slippage: 0.45,
        dex: 'jupiter',
        action: 'BUY'
      });

      if (tradeResult.success) {
        logger.info('Trade executed successfully:', {
          signature: tradeResult.signature,
          tokenAddress: signal.tokenAddress,
          amount: tradeAmount
        });

        // Create trade memory object
        const tradeMemory: Memory = {
          userId: `${signal.positionId}-0000-0000-0000-000000000000`, // Convert to UUID format
          agentId: this.runtime.agentId,
          roomId: `${signal.positionId}-0000-0000-0000-000000000000`, // Convert to UUID format
          content: {
            text: `Execute trade for ${signal.tokenAddress}`,
            tokenAddress: signal.tokenAddress,
            amount: tradeAmount,
            action: "buy",
            source: "system",
            type: "trade",
          },
        };

        // Create trade context object
        const tradeContent = {
          text: `Execute trade for ${signal.tokenAddress}`,
          tokenAddress: signal.tokenAddress,
          tradeAmount,
          memory: [tradeMemory], // Use memory instead of tradeMemory
          type: "trade_execution",
          timestamp: new Date().toISOString(),
          trade: {
            action: "buy",
            tokenAddress: signal.tokenAddress,
            amount: tradeAmount,
            signature: tradeResult.signature,
            chain: "solana"
          }
        } as Content;

        // Store trade information in state
        await this.runtime.composeState({
          userId: `${signal.positionId}-0000-0000-0000-000000000000`,
          agentId: this.runtime.agentId,
          roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`,
          content: tradeContent
        });

        const uuid = uuidv4() as UUID;
        const recommender = { id: signal.entityId || "default" };

        // Add performance tracking
        await this.addTradePerformance({
          token_address: signal.tokenAddress,
          recommender_id: recommender.id,
          buy_price: Number(quoteData.swapUsdValue) / (Number(quoteData.outAmount) / 1e9),
          buy_timeStamp: new Date().toISOString(),
          buy_amount: Number(quoteData.outAmount) / 1e9,
          buy_value_usd: Number(quoteData.swapUsdValue),
          buy_market_cap: Number(quoteData.marketCap) || 0,
          buy_liquidity: Number(quoteData.liquidity?.usd) || 0,
          buy_sol: tradeAmount,
          last_updated: new Date().toISOString(),
          sell_price: 0,
          sell_timeStamp: "",
          sell_amount: 0,
          received_sol: 0,
          sell_value_usd: 0,
          sell_market_cap: 0,
          sell_liquidity: 0,
          profit_usd: 0,
          profit_percent: 0,
          market_cap_change: 0,
          liquidity_change: 0,
          rapidDump: false
        }, false);

        logger.info('Trade performance added successfully:', {
          uuid,
          recommender
        });

        // Add transaction to tracking
        await this.addDegenTransaction({
          id: signal.positionId,
          address: signal.tokenAddress,
          amount: quoteData.outAmount,
          walletAddress: this.runtime.getSetting("SOLANA_PUBLIC_KEY"),
          isSimulation: false,
          marketCap: quoteData.marketCap || 0,
          entityId: recommender.id,
          txHash: tradeResult.signature
        });

        logger.info('Buy execution completed successfully:', {
          signal,
          signature: tradeResult.signature,
          amount: tradeAmount
        });
        
        // Trigger a price signal to track the token
        // TODO: This is totally wrong
        this.runtime.databaseAdapter.createMemory({
          content: {
            data: {
              tokenAddress: signal.tokenAddress,
              buyPrice: Number(quoteData.swapUsdValue) / (Number(quoteData.outAmount) / 1e9),
              amount: tradeAmount,
              signature: tradeResult.signature,
            }
          },
          metadata: {
            type: "buy_complete",
          },
          agentId: this.runtime.agentId,
          roomId: this.runtime.agentId,
          userId: this.runtime.agentId,
        }, "trade_performance"); // this might be wrong
        
        return {
          ...tradeResult,
          entityId: recommender.id,
          outAmount: quoteData.outAmount,
          swapUsdValue: quoteData.swapUsdValue
        };
      }
      logger.warn('Buy execution failed or was rejected:', {
        signal,
        error: tradeResult.error
      });
      return {success: false, error: tradeResult.error};
    } catch (error) {
      logger.error('Failed to process buy signal:', error);
      return {success: false, error: error instanceof Error ? error.message : String(error)};
    }
  }

  //
  // SELL SERVICE FUNCTIONALITY
  //

  /**
   * Handles sell signal processing
   */
  async handleSellSignal(
    signal: SellSignalMessage
  ): Promise<{success: boolean; signature?: string; error?: string}> {

    const TRADER_SELL_KUMA = this.runtime.getSetting("TRADER_SELL_KUMA");
    if (TRADER_SELL_KUMA) {
      fetch(TRADER_SELL_KUMA).catch((e) => {
        console.error("TRADER_SELL_KUMA err", e);
      });
    }

    const tokenAddress = signal.tokenAddress;

    try {
      const sellAmount = BigInt(signal.amount);

      try {
        // Record pending sell
        this.pendingSells[tokenAddress] = (this.pendingSells[tokenAddress] || BigInt(0)) + sellAmount;

        // Get quote
        const quoteResponse = await this.getQuote({
          inputMint: tokenAddress,
          outputMint: 'So11111111111111111111111111111111111111112',
          amount: sellAmount.toString(),
          walletAddress: signal.walletAddress,
          slippageBps: 4500
        });

        // Log the quote details for debugging
        logger.info('Quote details:', {
          inputAmount: signal.amount,
          currentBalance: signal.currentBalance,
          quoteAmount: quoteResponse.quoteData.inAmount,
          outAmount: quoteResponse.quoteData.outAmount,
          swapMode: quoteResponse.quoteData.swapMode
        });

        // Execute the sell trade using the transaction from quote
        const transactionBuf = Buffer.from(quoteResponse.swapTransaction, "base64");
        const transaction = VersionedTransaction.deserialize(transactionBuf);
        const keypair = getWalletKeypair(this.runtime);
        transaction.sign([keypair]);

        // Execute the signed transaction
        const connection = new Connection("https://zondra-wil7oz-fast-mainnet.helius-rpc.com");
        const signature = await connection.sendTransaction(transaction);

        if (signature) {
          logger.info('Sell trade executed successfully:', {
            signature,
            tokenAddress,
            amount: signal.amount
          });

          // Get latest blockhash for confirmation
          const latestBlockhash = await connection.getLatestBlockhash();

          try {
            const confirmation = await connection.confirmTransaction(
              {
                signature: signature,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                blockhash: latestBlockhash.blockhash,
              },
              "finalized"
            );

            if (confirmation.value.err) {
              logger.error('Transaction confirmation failed:', {
                error: confirmation.value.err,
                signature: signature
              });
              return { success: false, error: 'Transaction confirmation failed' };
            }

            try {
              // Update trade performance with sell information
              const latestTrade = await this.getLatestTradePerformance(
                tokenAddress,
                signal.sellRecommenderId,
                false
              );

              if (latestTrade) {
                const currentPrice = Number(quoteResponse.quoteData.swapUsdValue) / Number(signal.amount);
                const sellAmount = Number(signal.amount);
                const sellValueUsd = Number(quoteResponse.quoteData.swapUsdValue);
                const marketCap = 0; // Could be fetched from Birdeye if needed
                const liquidity = 0; // Could be fetched from Birdeye if needed

                await this.updateTradePerformanceOnSell(
                  tokenAddress,
                  signal.sellRecommenderId,
                  latestTrade.buy_timeStamp,
                  {
                    sell_price: currentPrice,
                    sell_timeStamp: new Date().toISOString(),
                    sell_amount: sellAmount,
                    received_sol: Number(quoteResponse.quoteData.outAmount) / 1e9,
                    sell_value_usd: sellValueUsd,
                    sell_market_cap: marketCap,
                    market_cap_change: marketCap - latestTrade.buy_market_cap,
                    sell_liquidity: liquidity,
                    liquidity_change: liquidity - latestTrade.buy_liquidity,
                    profit_usd: sellValueUsd - latestTrade.buy_value_usd,
                    profit_percent: (sellValueUsd - latestTrade.buy_value_usd) / latestTrade.buy_value_usd * 100,
                    rapidDump: false,
                    sell_recommender_id: signal.sellRecommenderId
                  },
                  false
                );
              }

              await this.addDegenTransaction({
                id: signal.positionId,
                address: tokenAddress,
                amount: signal.amount,
                walletAddress: signal.walletAddress,
                isSimulation: signal.isSimulation,
                marketCap: 0,
                entityId: signal.sellRecommenderId,
                txHash: signature
              });
              
              // Create a memory for the sell completion
              // TODO: This is totally wrong
              this.runtime.databaseAdapter.createMemory({
                content: {
                  data: {
                    tokenAddress: signal.tokenAddress,
                    sellPrice: Number(quoteResponse.quoteData.swapUsdValue) / Number(signal.amount),
                    amount: signal.amount,
                    signature: signature,
                  }
                },
                metadata: {
                  type: "sell_complete",
                },
                agentId: this.runtime.agentId,
                roomId: this.runtime.agentId,
                userId: this.runtime.agentId,
              }, "trade_performance");

              return { success: true, signature: signature };
            } catch (error) {
              logger.error('Error in post-trade processing:', {
                error: error instanceof Error ? error.message : error,
                signature: signature
              });
              // Still return success since the trade itself worked
              return { success: true, signature: signature };
            }
          } catch (error) {
            logger.error('Error confirming transaction:', {
              error: error instanceof Error ? error.message : error,
              signature: signature
            });
            return { success: false, error: 'Transaction confirmation error' };
          }
        } else {
          logger.warn('Sell execution failed:', {
            signal,
            error: 'Transaction signature is undefined'
          });
          return { success: false, error: 'Transaction signature is undefined' };
        }
      } finally {
        // Remove from pending sells whether successful or not
        this.pendingSells[tokenAddress] = (this.pendingSells[tokenAddress] || BigInt(0)) - sellAmount;
        if (this.pendingSells[tokenAddress] <= BigInt(0)) {
          delete this.pendingSells[tokenAddress];
        }
      }
    } catch (error) {
      logger.error('Failed to process sell signal:', error);
      return {success: false, error: error instanceof Error ? error.message : String(error)};
    }
  }

  //
  // TASK MANAGEMENT
  //

  /**
   * Creates a task for buying
   */
  async createBuyTask(signal: BuySignalMessage) {
    const taskId = uuidv4() as UUID;
    await this.runtime.databaseAdapter.createTask({
      id: taskId,
      roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`, // Generate a unique room ID
      name: "EXECUTE_BUY",
      description: `Execute buy for ${signal.tokenAddress}`,
      tags: ["queue", "trade", "buy"],
      metadata: {
        signal,
        updatedAt: Date.now(),
        updateInterval: 0 // Execute immediately
      }
    });
    
    return taskId;
  }

  /**
   * Creates a task for selling
   */
  async createSellTask(signal: SellSignalMessage) {
    const taskId = uuidv4() as UUID;
    await this.runtime.databaseAdapter.createTask({
      id: taskId,
      roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`, // Generate a unique room ID
      name: "EXECUTE_SELL",
      description: `Execute sell for ${signal.tokenAddress}`,
      tags: ["queue", "trade", "sell"],
      metadata: {
        signal,
        updatedAt: Date.now(),
        updateInterval: 0 // Execute immediately
      }
    });
    
    return taskId;
  }

  /**
   * Execute buy task
   */
  private async executeBuyTask(options: any) {
    const signal = options.signal;
    if (!signal) {
      logger.error('No signal data in buy task');
      return { success: false, error: 'Missing signal data' };
    }
    
    return await this.handleBuySignal(signal);
  }

  /**
   * Execute sell task
   */
  private async executeSellTask(options: any) {
    const signal = options.signal;
    if (!signal) {
      logger.error('No signal data in sell task');
      return { success: false, error: 'Missing signal data' };
    }
    
    // Validate amounts before executing sell
    if (!signal.amount || Number(signal.amount) <= 0) {
      logger.warn('Invalid sell amount:', {
        amount: signal.amount,
        currentBalance: signal.currentBalance
      });
      return { success: false, error: 'Invalid sell amount' };
    }

    // Verify we have enough balance
    if (Number(signal.amount) > Number(signal.currentBalance)) {
      logger.warn('Insufficient balance for sell:', {
        sellAmount: signal.amount,
        currentBalance: signal.currentBalance
      });
      return { success: false, error: 'Insufficient balance' };
    }
    
    return await this.handleSellSignal(signal);
  }

  /**
   * Generates a buy signal based on market data
   */
  private async generateBuySignal() {
    logger.info('Generating scheduled buy signal');

    try {
      const walletBalance = await getWalletBalance(this.runtime);
      if (walletBalance < 0.1) {
        logger.info('Insufficient balance for scheduled buy', { walletBalance });
        return { success: true };
      }

      // Get token recommendation
      const recommendation = await this.getTokenRecommendation();

      if (!recommendation) {
        logger.info('No token recommendation available');
        return { success: true };
      }

      // Create buy signal
      const buySignal: BuySignalMessage = {
        positionId: `sol-process-${Date.now()}`,
        tokenAddress: recommendation.recommend_buy_address,
        entityId: "default",
      };

      // Create a buy task
      await this.createBuyTask(buySignal);
      logger.info('Scheduled buy signal created');
      return { success: true };
    } catch (error) {
      logger.error('Failed to process scheduled buy signal:', error);
      throw error;
    }
  }

  /**
   * Syncs wallet information
   */
  private async syncWallet() {
    try {
      logger.info('Syncing wallet information');
      const walletBalance = await getWalletBalance(this.runtime);
      logger.info('Wallet balance synced', { balance: walletBalance });
      
      // Store wallet balance in cache
      await this.runtime.databaseAdapter.setCache<any>('wallet_balance', {
        balance: walletBalance,
        timestamp: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to sync wallet:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Registers tasks with the runtime
   */
  async registerTasks() {
    logger.info("Registering trade tasks...");

    // Register BUY task worker
    this.runtime.registerTaskWorker({
      name: "EXECUTE_BUY",
      execute: async (_runtime: IAgentRuntime, options: any) => {
        await this.executeBuyTask(options);
      },
      validate: async () => true
    });

    // Register SELL task worker
    this.runtime.registerTaskWorker({
      name: "EXECUTE_SELL",
      execute: async (_runtime: IAgentRuntime, options: any) => {
        await this.executeSellTask(options);
      },
      validate: async () => true
    });

    // Register GENERATE_BUY_SIGNAL task worker
    this.runtime.registerTaskWorker({
      name: "GENERATE_BUY_SIGNAL",
      execute: async () => {
        await this.generateBuySignal();
      },
      validate: async () => true
    });

    // Register SYNC_WALLET task worker
    this.runtime.registerTaskWorker({
      name: "SYNC_WALLET",
      execute: async () => {
        await this.syncWallet();
      },
      validate: async () => true
    });
    
    // Register MONITOR_TOKEN task worker
    this.runtime.registerTaskWorker({
      name: "MONITOR_TOKEN",
      execute: async (_runtime: IAgentRuntime, options: any) => {
        await this.monitorToken(options);
      },
      validate: async () => true
    });

    // Create scheduled tasks
    await this.createScheduledTasks();

    logger.info("Trade tasks registered successfully");
  }

  /**
   * Creates scheduled tasks
   */
  private async createScheduledTasks() {
    // Clear existing schedules for this agent
    const existingTasks = await this.runtime.databaseAdapter.getTasks({
      tags: ["queue", "schedule", "trade"]
    });
    
    for (const task of existingTasks) {
      await this.runtime.databaseAdapter.deleteTask(task.id!);
    }

    // Schedule buy signal generation every 10 minutes (600000ms)
    await this.runtime.databaseAdapter.createTask({
      id: uuidv4() as UUID,
      roomId: this.runtime.agentId,
      name: "GENERATE_BUY_SIGNAL",
      description: "Generate buy signal every 10 minutes",
      tags: ["queue", "schedule", "trade"],
      metadata: {
        updatedAt: Date.now(),
        updateInterval: 600000, // 10 minutes
        repeat: true
      }
    });

    // Schedule wallet sync every 10 minutes
    await this.runtime.databaseAdapter.createTask({
      id: uuidv4() as UUID,
      roomId: this.runtime.agentId,
      name: "SYNC_WALLET",
      description: "Sync wallet information every 10 minutes",
      tags: ["queue", "schedule", "trade"],
      metadata: {
        updatedAt: Date.now(),
        updateInterval: 600000, // 10 minutes
        repeat: true
      }
    });
  }

  //
  // START/STOP SERVICE
  //

  /**
   * Starts the trading service
   */
  async start(): Promise<void> {
    logger.info('Starting trading service...');

    if (this.isRunning) {
      logger.warn('Trading service is already running');
      return;
    }

    try {
      logger.info('Setting isRunning flag to true');
      this.isRunning = true;

      // Get token recommendation from data layer
      const tokenData = await this.getTokenRecommendation();
      logger.info('Received token recommendation:', tokenData);

      // Get wallet's SOL balance using utility function
      logger.info('Fetching wallet balance...');
      const walletBalance = await getWalletBalance(this.runtime);
      logger.info('Wallet SOL balance:', { balance: walletBalance });

      // 1. Buy Token
      const buySignal = {
        tokenAddress: tokenData.recommend_buy_address,
        amount: walletBalance * 0.1,
        positionId: this.processId,
        entityId: "default"
      };
      logger.info('Preparing to execute buy signal:', buySignal);

      const buyResult = await this.handleBuySignal(buySignal);
      logger.info('Buy signal result:', {
        buyResult,
        quoteOutAmount: buyResult.outAmount,
        swapUsdValue: buyResult.swapUsdValue
      });

      // 2. Start Process
      logger.info('Starting trading process...');

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
        logger.info('Birdeye API response:', data);

        initialPrice = data?.data?.price?.toString() || "0";
      } catch (error) {
        logger.error('Failed to fetch price from Birdeye:', error);
      }

      // Debug buyResult
      logger.info('Buy result details:', {
        success: buyResult.success,
        outAmount: buyResult.outAmount,
        signature: buyResult.signature
      });

      const degenProcessData = {
        id: this.processId,
        tokenAddress: tokenData.recommend_buy_address,
        balance: buyResult.outAmount?.toString() || "0",
        isSimulation: false,
        initialMarketCap: tokenData.marketcap.toString(),
        initialPrice,
        entityId: buyResult.entityId || "default",
        walletAddress: this.runtime.getSetting("SOLANA_PUBLIC_KEY"),
        txHash: buyResult.success ? buyResult.signature : `${this.processId}-init`,
      };

      logger.info('Starting process with data:', degenProcessData);
      await this.startDegenProcess(degenProcessData);
      logger.info('Trading process started successfully');

    } catch (error) {
      logger.error('Failed to start trading service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stops the trading service
   */
  async stop(): Promise<void> {
    logger.info('Stopping trading service');
    try {
      // Stop the monitoring process
      await this.stopDegenProcess(this.processId);
      this.isRunning = false;
      logger.info('Trading service stopped', { processId: this.processId });
      
      // Cancel all scheduled tasks
      const existingTasks = await this.runtime.databaseAdapter.getTasks({
        tags: ["queue", "schedule", "trade"]
      });
      
      for (const task of existingTasks) {
        await this.runtime.databaseAdapter.deleteTask(task.id!);
      }

    } catch (error) {
      logger.error('Error stopping trading service:', error);
      throw error;
    }
  }

  /**
   * Checks if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  //
  // TRADE PERFORMANCE TRACKING & API METHODS
  //

  /**
   * Gets quote for a trade
   */
  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    walletAddress: string;
    slippageBps: number;
  }): Promise<any> {
    try {
      // Implement quote retrieval from Jupiter API
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${params.slippageBps}`
      );
      
      if (!response.ok) {
        throw new Error(`Jupiter API returned ${response.status}`);
      }
      
      const quoteData = await response.json();
      
      // Get swap transaction from the Jupiter API
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: params.walletAddress
        })
      });
      
      if (!swapResponse.ok) {
        throw new Error(`Jupiter swap API returned ${swapResponse.status}`);
      }
      
      const swapData = await swapResponse.json();
      
      return {
        quoteData,
        swapTransaction: swapData.swapTransaction
      };
    } catch (error) {
      logger.error('Error getting quote:', error);
      throw error;
    }
  }

  /**
   * Starts monitoring process for a token
   */
  async startDegenProcess(data: {
    id: string;
    tokenAddress: string;
    balance: string;
    isSimulation: boolean;
    initialMarketCap: string;
    initialPrice: string;
    entityId: string;
    walletAddress: string;
    txHash: string;
  }): Promise<void> {
    try {
      logger.info('Starting token monitoring process:', data);
      
      // Store token data in cache
      await this.runtime.databaseAdapter.setCache<any>(`token_monitor:${data.tokenAddress}`, {
        ...data,
        startTime: Date.now()
      });
      
      // Create a task for monitoring
      await this.runtime.databaseAdapter.createTask({
        id: uuidv4() as UUID,
        roomId: this.runtime.agentId,
        name: "MONITOR_TOKEN",
        description: `Monitor token ${data.tokenAddress}`,
        tags: ["queue", "monitor", "trade"],
        metadata: {
          tokenAddress: data.tokenAddress,
          initialPrice: data.initialPrice,
          initialMarketCap: data.initialMarketCap,
          startTime: Date.now(),
          updatedAt: Date.now(),
          updateInterval: 60000, // Check every minute
          repeat: true
        }
      });
      
    } catch (error) {
      logger.error('Error starting token monitoring process:', error);
      throw error;
    }
  }

  /**
   * Stops monitoring process for a token
   */
  async stopDegenProcess(processId: string): Promise<void> {
    try {
      // Find monitoring tasks for this process
      const tasks = await this.runtime.databaseAdapter.getTasks({
        tags: ["queue", "monitor", "trade"]
      });
      
      // Delete all related monitoring tasks
      for (const task of tasks) {
        await this.runtime.databaseAdapter.deleteTask(task.id!);
      }
      
      logger.info('Token monitoring process stopped', { processId });
      
    } catch (error) {
      logger.error('Error stopping token monitoring process:', error);
      throw error;
    }
  }

  /**
   * Monitor token price and performance
   */
  private async monitorToken(options: any): Promise<any> {
    try {
      const { tokenAddress, initialPrice, initialMarketCap } = options;
      
      // Get current price from Birdeye
      const response = await fetch(
        `https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenAddress}`,
        {
          headers: {
            'X-API-KEY': this.runtime.getSetting("BIRDEYE_API_KEY") || '',
          }
        }
      );
      
      if (!response.ok) {
        logger.error('Failed to fetch current price from Birdeye', {
          status: response.status
        });
        return { success: false };
      }
      
      const data = await response.json();
      const currentPrice = data?.data?.price?.toString() || "0";
      const currentMarketCap = data?.data?.marketCap?.toString() || "0";
      
      // Calculate price change
      const initialPriceNum = Number.parseFloat(initialPrice);
      const currentPriceNum = Number.parseFloat(currentPrice);
      const priceChange = initialPriceNum > 0 
        ? ((currentPriceNum - initialPriceNum) / initialPriceNum) * 100 
        : 0;
      
      // Log price information
      logger.info('Token price update:', {
        tokenAddress,
        initialPrice,
        currentPrice,
        priceChange: `${priceChange.toFixed(2)}%`,
        initialMarketCap,
        currentMarketCap
      });
      
      // Store price update in cache
      await this.runtime.databaseAdapter.setCache<any>(`price:${tokenAddress}`, {
        initialPrice,
        currentPrice,
        priceChange,
        initialMarketCap,
        currentMarketCap,
        timestamp: new Date().toISOString()
      });
      
      // Create a memory for price update
      this.runtime.databaseAdapter.createMemory({
        content: {
          data: {
            tokenAddress,
            initialPrice,
            currentPrice,
            priceChange,
            initialMarketCap,
            currentMarketCap,
          }
        },
        agentId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        userId: this.runtime.agentId,
        metadata: {
          type: "price_update",
        }
      }, "price_update");
      
      // Check for sell conditions (example: 20% profit or 10% loss)
      if (priceChange >= 20 || priceChange <= -10) {
        logger.info('Sell condition met', { priceChange });
        
        // Get token balance from cache
        const tokenMonitor = await this.runtime.databaseAdapter.getCache<any>(`token_monitor:${tokenAddress}`);
        if (tokenMonitor?.balance) {
          // Create sell signal
          const sellSignal: SellSignalMessage = {
            tokenAddress,
            amount: tokenMonitor.balance,
            currentBalance: tokenMonitor.balance,
            positionId: tokenMonitor.id,
            walletAddress: tokenMonitor.walletAddress,
            isSimulation: tokenMonitor.isSimulation,
            sellRecommenderId: tokenMonitor.entityId,
            pairId: ""
          };
          
          // Create a task to execute the sell
          await this.createSellTask(sellSignal);
          logger.info('Created sell task based on price condition', { priceChange, tokenAddress });
        }
      }
      
      return { success: true };
    } catch (error) {
      logger.error('Error monitoring token:', error);
      return { success: false };
    }
  }

  /**
   * Add transaction to tracking
   */
  async addDegenTransaction(data: {
    id: string;
    address: string;
    amount: string;
    walletAddress: string;
    isSimulation: boolean;
    marketCap: number;
    entityId: string;
    txHash: string;
  }): Promise<void> {
    try {
      const transactionData = {
        id: data.id,
        tokenAddress: data.address,
        amount: data.amount,
        walletAddress: data.walletAddress,
        isSimulation: data.isSimulation,
        marketCap: data.marketCap,
        entityId: data.entityId,
        txHash: data.txHash,
        timestamp: new Date().toISOString()
      };
      
      // Store transaction in cache
      this.runtime.databaseAdapter.setCache<any>(data.id, transactionData);
      
      // Store in the runtime cache
      await this.runtime.databaseAdapter.setCache<any>(`transaction:${data.id}`, transactionData);
      
      // Create a memory for transaction tracking
      await this.runtime.databaseAdapter.createMemory({
        content: {
          data: transactionData,
          tokenAddress: data.address
        },
        agentId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        userId: this.runtime.agentId,
        unique: true,
        metadata: {
          type: "transaction",
        }
      },
      "transaction"
    );
      
      logger.info('Transaction added to tracking', {
        id: data.id,
        tokenAddress: data.address,
        txHash: data.txHash
      });
      
    } catch (error) {
      logger.error('Error adding transaction to tracking:', error);
      throw error;
    }
  }

  /**
   * Add trade performance record
   */
  async addTradePerformance(data: {
    token_address: string;
    recommender_id: string;
    buy_price: number;
    buy_timeStamp: string;
    buy_amount: number;
    buy_value_usd: number;
    buy_market_cap: number;
    buy_liquidity: number;
    buy_sol: number;
    last_updated: string;
    sell_price: number;
    sell_timeStamp: string;
    sell_amount: number;
    received_sol: number;
    sell_value_usd: number;
    sell_market_cap: number;
    sell_liquidity: number;
    profit_usd: number;
    profit_percent: number;
    market_cap_change: number;
    liquidity_change: number;
    rapidDump: boolean;
  }, isSimulation: boolean): Promise<any> {
    try {
      // Create a unique ID for the trade performance record
      const id = uuidv4() as UUID;
      
      const tradePerformanceData = {
        id,
        token_address: data.token_address,
        recommender_id: data.recommender_id,
        buy_price: data.buy_price,
        buy_timeStamp: data.buy_timeStamp,
        buy_amount: data.buy_amount,
        buy_value_usd: data.buy_value_usd,
        buy_market_cap: data.buy_market_cap,
        buy_liquidity: data.buy_liquidity,
        buy_sol: data.buy_sol,
        last_updated: data.last_updated,
        sell_price: data.sell_price,
        sell_timeStamp: data.sell_timeStamp,
        sell_amount: data.sell_amount,
        received_sol: data.received_sol,
        sell_value_usd: data.sell_value_usd,
        sell_market_cap: data.sell_market_cap,
        sell_liquidity: data.sell_liquidity,
        profit_usd: data.profit_usd,
        profit_percent: data.profit_percent,
        market_cap_change: data.market_cap_change,
        liquidity_change: data.liquidity_change,
        rapidDump: data.rapidDump,
        isSimulation
      };
      
      // TODO: Do we need to save both caches? they have the same data

      // Store in local cache
      this.runtime.databaseAdapter.setCache<any>(`${data.token_address}:${data.recommender_id}`, tradePerformanceData);
      
      // Store in runtime cache
      await this.runtime.databaseAdapter.setCache<any>(`trade_performance:${id}`, tradePerformanceData);
      
      // Add to performance index
      const performanceIndex = await this.runtime.databaseAdapter.getCache<any>('trade_performance_index') || [];
      performanceIndex.push({
        id,
        token_address: data.token_address,
        recommender_id: data.recommender_id,
        buy_timeStamp: data.buy_timeStamp
      });
      await this.runtime.databaseAdapter.setCache<any>('trade_performance_index', performanceIndex);
      
      // Create a memory for trade performance
      await this.runtime.databaseAdapter.createMemory({
        content: {
          data: tradePerformanceData,
        },
        agentId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        userId: this.runtime.agentId,
        metadata: {
          type: "trade_performance",
        }
      }, "trade_performance");
      
      logger.info('Trade performance record added', {
        id,
        token_address: data.token_address,
        recommender_id: data.recommender_id
      });
      
      return { id };
    } catch (error) {
      logger.error('Error adding trade performance record:', error);
      throw error;
    }
  }

  /**
   * Get latest trade performance for a token
   */
  async getLatestTradePerformance(
    tokenAddress: string,
    recommenderId: string,
    isSimulation: boolean
  ): Promise<any> {
    try {
      // Check local cache first
      const cacheKey = `${tokenAddress}:${recommenderId}`;
      if (this.runtime.databaseAdapter.getCache<any>(cacheKey)) {
        const cached = await this.runtime.databaseAdapter.getCache<any>(cacheKey);
        if (cached.isSimulation === isSimulation) {
          return cached;
        }
      }
      
      // Get performance index from cache
      const performanceIndex = await this.runtime.databaseAdapter.getCache<any[]>('trade_performance_index') || [];
      
      // Filter and sort by buy timestamp (descending)
      const filtered = performanceIndex
        .filter(entry => 
          entry.token_address === tokenAddress && 
          entry.recommender_id === recommenderId
        )
        .sort((a, b) => new Date(b.buy_timeStamp).getTime() - new Date(a.buy_timeStamp).getTime());
      
      if (filtered.length > 0) {
        // Get full record from cache for the most recent entry
        const latestEntry = filtered[0];
        const fullRecord = await this.runtime.databaseAdapter.getCache<any>(`trade_performance:${latestEntry.id}`);
        
        if (fullRecord) {
          // Update local cache
          this.runtime.databaseAdapter.setCache<any>(cacheKey, fullRecord);
          return fullRecord;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting latest trade performance:', error);
      throw error;
    }
  }

  /**
   * Update trade performance on sell
   */
  async updateTradePerformanceOnSell(
    tokenAddress: string,
    recommenderId: string,
    buyTimestamp: string,
    sellData: {
      sell_price: number;
      sell_timeStamp: string;
      sell_amount: number;
      received_sol: number;
      sell_value_usd: number;
      sell_market_cap: number;
      market_cap_change: number;
      sell_liquidity: number;
      liquidity_change: number;
      profit_usd: number;
      profit_percent: number;
      rapidDump: boolean;
      sell_recommender_id: string;
    },
    isSimulation: boolean
  ): Promise<void> {
    try {
      // Get latest trade performance
      const record = await this.getLatestTradePerformance(tokenAddress, recommenderId, isSimulation);
      
      if (record) {
        // Update record with sell data
        const updatedRecord = {
          ...record,
          ...sellData,
          last_updated: new Date().toISOString()
        };
        
        // Update local cache
        this.runtime.databaseAdapter.setCache<any>(`${tokenAddress}:${recommenderId}`, updatedRecord);
        
        // Update runtime cache
        await this.runtime.databaseAdapter.setCache<any>(`trade_performance:${record.id}`, updatedRecord);
        
        // Create a memory for the updated trade performance
        await this.runtime.databaseAdapter.createMemory({
          content: {
            data: updatedRecord,
          },
          agentId: this.runtime.agentId,
          roomId: this.runtime.agentId,
          userId: this.runtime.agentId,
          metadata: {
            type: "trade_performance_update"
          }
        }, "trade_performance");
        
        logger.info('Trade performance updated with sell data', {
          id: record.id,
          token_address: tokenAddress,
          recommender_id: recommenderId,
          profit_usd: sellData.profit_usd,
          profit_percent: sellData.profit_percent
        });
      } else {
        logger.warn('No trade performance record found to update', {
          token_address: tokenAddress,
          recommender_id: recommenderId,
          buy_timeStamp: buyTimestamp
        });
      }
    } catch (error) {
      logger.error('Error updating trade performance on sell:', error);
      throw error;
    }
  }
}