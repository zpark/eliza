import { type IAgentRuntime, type Memory, type UUID, logger, ModelTypes } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import { BaseTradeService } from './base/BaseTradeService';

export interface TradeMemory {
  id: UUID;
  tokenAddress: string;
  chain: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  timestamp: Date;
  txHash?: string;
  metadata?: {
    slippage?: number;
    expectedAmount?: string;
    receivedAmount?: string;
    valueUsd?: string;
  };
}

export class TradeMemoryService extends BaseTradeService {
  private tradeMemoryManager: any; // Will be initialized with runtime.getMemoryManager

  constructor(runtime: IAgentRuntime, ...services: any[]) {
    super(runtime, ...services);
  }

  async initialize(): Promise<void> {
    logger.info("Initializing trade memory service");
    
    // Register memory manager for trades if not exists
    if (!this.runtime.getMemoryManager("trades")) {
      this.tradeMemoryManager = this.runtime.registerMemoryManager({
        tableName: "trades",
        runtime: this.runtime
      });
    } else {
      this.tradeMemoryManager = this.runtime.getMemoryManager("trades");
    }
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  async storeTrade(trade: TradeMemory): Promise<void> {
    try {
      // Create memory object with embedding
      const memoryContent = `${trade.type} trade for ${trade.tokenAddress} on ${trade.chain} at ${trade.timestamp.toISOString()}. Amount: ${trade.amount}, Price: ${trade.price}`;
      
      const memory: Memory = {
        id: trade.id,
        userId: this.runtime.agentId as UUID,
        roomId: "global" as UUID,
        content: {
          text: memoryContent,
          trade
        },
        createdAt: Date.now()
      };

      // Add embedding to memory
      const embedding = await this.runtime.useModel(ModelTypes.TEXT_EMBEDDING, memoryContent);
      const memoryWithEmbedding = { ...memory, embedding };

      // Store in memory manager
      await this.tradeMemoryManager.createMemory(memoryWithEmbedding, true);

      // Also cache for quick access
      const cacheKey = `trade:${trade.chain}:${trade.tokenAddress}:${trade.txHash}`;
      await this.runtime.databaseAdapter.setCache(cacheKey, trade, 60 * 60 * 1000); // Cache for 1 hour

      logger.info(`Stored ${trade.type} trade for ${trade.tokenAddress}`);
    } catch (error) {
      logger.error(`Error storing trade for ${trade.tokenAddress}:`, error);
      throw error;
    }
  }

  async getTradesForToken(tokenAddress: string, chain: string): Promise<TradeMemory[]> {
    try {
      // Query memories with similar content about this token
      const memories = await this.tradeMemoryManager.getMemories({
        filter: (memory: Memory) => {
          const trade = memory.content.trade as TradeMemory;
          return trade.tokenAddress === tokenAddress && trade.chain === chain;
        },
        count: 100 // Limit to last 100 trades
      });

      // Sort by timestamp descending
      return memories
        .map(memory => memory.content.trade as TradeMemory)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      logger.error(`Error getting trades for token ${tokenAddress}:`, error);
      return [];
    }
  }

  async createTrade(params: {
    tokenAddress: string,
    chain: string,
    type: 'BUY' | 'SELL',
    amount: string,
    price: string,
    txHash?: string,
    metadata?: TradeMemory['metadata']
  }): Promise<TradeMemory> {
    const trade: TradeMemory = {
      id: uuidv4() as UUID,
      timestamp: new Date(),
      ...params
    };

    await this.storeTrade(trade);
    return trade;
  }

  async getRecentTrades(limit: number = 10): Promise<TradeMemory[]> {
    try {
      const memories = await this.tradeMemoryManager.getMemories({
        count: limit,
        sort: (a: Memory, b: Memory) => {
          const tradeA = a.content.trade as TradeMemory;
          const tradeB = b.content.trade as TradeMemory;
          return tradeB.timestamp.getTime() - tradeA.timestamp.getTime();
        }
      });

      return memories.map(memory => memory.content.trade as TradeMemory);
    } catch (error) {
      logger.error("Error getting recent trades:", error);
      return [];
    }
  }

  async searchTrades(query: string): Promise<TradeMemory[]> {
    try {
      // Get embedding for search query
      const queryEmbedding = await this.runtime.useModel(ModelTypes.TEXT_EMBEDDING, query);

      // Search memories with similar embeddings
      const memories = await this.tradeMemoryManager.searchMemories(queryEmbedding, {
        count: 10,
        threshold: 0.7 // Similarity threshold
      });

      return memories.map(memory => memory.content.trade as TradeMemory);
    } catch (error) {
      logger.error("Error searching trades:", error);
      return [];
    }
  }

  async deleteTrade(tradeId: UUID): Promise<void> {
    try {
      await this.tradeMemoryManager.removeMemory(tradeId);
      logger.info(`Deleted trade ${tradeId}`);
    } catch (error) {
      logger.error(`Error deleting trade ${tradeId}:`, error);
      throw error;
    }
  }
} 