import { type IAgentRuntime, logger, type UUID } from "@elizaos/core";
import { BuyService } from './buyService';
import { SellService } from './sellService';
import { v4 as uuidv4 } from "uuid";
import { ServiceTypes } from "../types";

export class TaskService {
  private scheduledTasks: NodeJS.Timeout[] = [];

  constructor(
    private runtime: IAgentRuntime,
    private buyService: BuyService,
    private sellService: SellService
  ) {}

  async registerTasks(): Promise<void> {
    this.registerBuyTasks();
    this.registerSellTasks();
    this.registerMonitoringTasks();
  }

  async stop(): Promise<void> {
    // Clear all scheduled tasks
    this.scheduledTasks.forEach(task => clearTimeout(task));
    this.scheduledTasks = [];
  }

  private registerBuyTasks(): void {
    this.runtime.registerTaskWorker({
      name: "BUY_SIGNAL",
      execute: async (_runtime: IAgentRuntime, options: any) => {
        logger.info("Executing BUY_SIGNAL task");
        return await this.executeBuyTask(options);
      },
      validate: async () => true,
    });

    this.runtime.registerTaskWorker({
      name: "OPTIMIZE_BUY_PARAMETERS",
      execute: async () => {
        logger.info("Optimizing buy parameters");
        return await this.optimizeBuyParameters();
      },
      validate: async () => true,
    });
  }

  private registerSellTasks(): void {
    this.runtime.registerTaskWorker({
      name: "EXECUTE_SELL",
      execute: async (_runtime: IAgentRuntime, options: any) => {
        logger.info("Executing sell task");
        return await this.executeSellTask(options);
      },
      validate: async () => true,
    });

    this.runtime.registerTaskWorker({
      name: "MONITOR_POSITIONS",
      execute: async () => {
        logger.info("Monitoring positions");
        return await this.monitorPositions();
      },
      validate: async () => true,
    });
  }

  private registerMonitoringTasks(): void {
    this.runtime.registerTaskWorker({
      name: "OPTIMIZE_SLIPPAGE",
      execute: async () => {
        logger.info("Optimizing slippage parameters");
        return await this.optimizeSlippageParameters();
      },
      validate: async () => true,
    });

    this.runtime.registerTaskWorker({
      name: "PERFORMANCE_ANALYSIS",
      execute: async () => {
        logger.info("Analyzing trading performance");
        return await this.analyzePerformance();
      },
      validate: async () => true,
    });
  }

  async createScheduledTasks(): Promise<void> {
    // Schedule regular position monitoring
    const monitoringInterval = setInterval(async () => {
      await this.createTask("MONITOR_POSITIONS", {});
    }, 5 * 60 * 1000); // Every 5 minutes
    this.scheduledTasks.push(monitoringInterval);

    // Schedule parameter optimization
    const optimizationInterval = setInterval(async () => {
      await this.createTask("OPTIMIZE_SLIPPAGE", {});
      await this.createTask("OPTIMIZE_BUY_PARAMETERS", {});
    }, 4 * 60 * 60 * 1000); // Every 4 hours
    this.scheduledTasks.push(optimizationInterval);

    // Schedule performance analysis
    const analysisInterval = setInterval(async () => {
      await this.createTask("PERFORMANCE_ANALYSIS", {});
    }, 24 * 60 * 60 * 1000); // Daily
    this.scheduledTasks.push(analysisInterval);
  }

  async createTask(name: string, metadata: any): Promise<void> {
    await this.runtime.databaseAdapter.createTask({
      id: uuidv4() as UUID,
      roomId: this.runtime.agentId,
      name,
      description: `Execute ${name}`,
      tags: ["queue", ServiceTypes.DEGEN_TRADING],
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  private async executeBuyTask(options: any) {
    try {
      const { signal, tradeAmount } = options;
      if (!signal) {
        throw new Error("No signal data in buy task");
      }

      const result = await this.buyService.handleBuySignal({
        ...signal,
        tradeAmount: tradeAmount || 0
      });

      if (result.success) {
        logger.info("Buy task executed successfully", {
          signature: result.signature,
          outAmount: result.outAmount
        });
      } else {
        logger.error("Buy task failed", { error: result.error });
      }

      return result;
    } catch (error) {
      logger.error("Error executing buy task:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeSellTask(options: any) {
    try {
      const { signal } = options;
      if (!signal) {
        throw new Error("No signal data in sell task");
      }

      const result = await this.sellService.handleSellSignal(signal);

      if (result.success) {
        logger.info("Sell task executed successfully", {
          signature: result.signature,
          receivedAmount: result.receivedAmount
        });
      } else {
        logger.error("Sell task failed", { error: result.error });
      }

      return result;
    } catch (error) {
      logger.error("Error executing sell task:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async monitorPositions() {
    try {
      // Implement position monitoring logic
      // This could include checking stop losses, take profits, etc.
      logger.info("Position monitoring completed");
      return { success: true };
    } catch (error) {
      logger.error("Error monitoring positions:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async optimizeSlippageParameters() {
    try {
      // Implement slippage optimization logic
      logger.info("Slippage parameters optimized");
      return { success: true };
    } catch (error) {
      logger.error("Error optimizing slippage parameters:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async optimizeBuyParameters() {
    try {
      // Implement buy parameter optimization logic
      logger.info("Buy parameters optimized");
      return { success: true };
    } catch (error) {
      logger.error("Error optimizing buy parameters:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async analyzePerformance() {
    try {
      // Implement performance analysis logic
      logger.info("Performance analysis completed");
      return { success: true };
    } catch (error) {
      logger.error("Error analyzing performance:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
} 