import { type IAgentRuntime, logger } from "@elizaos/core";
import { WalletService } from './walletService';
import { DataService } from './dataService';
import { AnalyticsService } from './analyticsService';
import { type SellSignalMessage } from '../types';
import { TradingConfig } from '../types/trading';

export class SellService {
  private pendingSells: { [tokenAddress: string]: bigint } = {};
  private tradingConfig: TradingConfig;

  constructor(
    private runtime: IAgentRuntime,
    private walletService: WalletService,
    private dataService: DataService,
    private analyticsService: AnalyticsService
  ) {
    this.tradingConfig = {
      intervals: {
        priceCheck: 60000,
        walletSync: 600000,
        performanceMonitor: 3600000,
      },
      thresholds: {
        minLiquidity: 50000,
        minVolume: 100000,
        minScore: 60,
      },
      riskLimits: {
        maxPositionSize: 0.2,
        maxDrawdown: 0.1,
        stopLossPercentage: 0.05,
        takeProfitPercentage: 0.2,
      },
      slippageSettings: {
        baseSlippage: 0.5,
        maxSlippage: 1.0,
        liquidityMultiplier: 1.0,
        volumeMultiplier: 1.0,
      },
    };
  }

  async initialize(): Promise<void> {
    logger.info("Initializing sell service");
  }

  async stop(): Promise<void> {
    this.pendingSells = {};
  }

  async handleSellSignal(signal: SellSignalMessage): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    receivedAmount?: string;
    receivedValue?: string;
  }> {
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
        this.pendingSells[tokenAddress] =
          (this.pendingSells[tokenAddress] || BigInt(0)) + sellAmount;

        // Convert token amount to number for calculations
        const sellAmountNum = Number(sellAmount);

        // Calculate dynamic slippage based on token metrics and trade size
        const slippageBps = await this.calculateDynamicSlippage(
          tokenAddress,
          sellAmountNum,
          true
        );

        logger.info("Getting quote for sell with dynamic slippage", {
          tokenAddress,
          inputAmount: sellAmount,
          slippageBps,
          dynamicSlippageApplied: true
        });

        // Get quote for expected amount
        const expectedAmount = await this.getExpectedAmount(
          tokenAddress,
          sellAmount.toString(),
          signal.walletAddress
        );

        // Get the wallet
        const wallet = await this.walletService.getWallet();
        if (!wallet) {
          throw new Error("No wallet available for trading");
        }

        // Execute the sell
        const result = await wallet.sell({
          tokenAddress: tokenAddress,
          tokenAmount: sellAmount.toString(),
          slippageBps: slippageBps,
        });

        if (result.success && result.signature) {
          // Track slippage impact
          if (result.receivedAmount && expectedAmount) {
            await this.analyticsService.trackSlippageImpact(
              tokenAddress,
              expectedAmount,
              result.receivedAmount,
              slippageBps,
              true
            );
          }

          logger.info("Sell successful", {
            signature: result.signature,
            receivedAmount: result.receivedAmount || "unknown"
          });

          return {
            success: true,
            signature: result.signature,
            receivedAmount: result.receivedAmount,
            receivedValue: result.swapUsdValue
          };
        }

        logger.error("Sell failed", { error: result.error });
        return { success: false, error: result.error };
      } finally {
        // Remove from pending sells whether successful or not
        this.pendingSells[tokenAddress] =
          (this.pendingSells[tokenAddress] || BigInt(0)) - sellAmount;
        if (this.pendingSells[tokenAddress] <= BigInt(0)) {
          delete this.pendingSells[tokenAddress];
        }
      }
    } catch (error) {
      console.log("Failed to process sell signal:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async calculateDynamicSlippage(
    tokenAddress: string,
    tradeAmount: number,
    isSell: boolean
  ): Promise<number> {
    try {
      const tokenData = await this.dataService.getTokenMarketData(tokenAddress);

      // Start with base slippage
      let slippage = this.tradingConfig.slippageSettings.baseSlippage;

      // Adjust for liquidity
      const liquidityPercentage = (tradeAmount / tokenData.liquidity) * 100;
      if (liquidityPercentage > 0.1) {
        const liquidityFactor = liquidityPercentage ** 1.5 * this.tradingConfig.slippageSettings.liquidityMultiplier;
        slippage += liquidityFactor * 0.01;
      }

      // Increase slippage for sells during high volatility
      if (isSell && tokenData.priceHistory) {
        const volatility = this.calculateVolatility(tokenData.priceHistory);
        if (volatility > 0.1) { // High volatility threshold
          slippage *= (1 + volatility);
        }
      }

      // Adjust for market conditions
      const marketCondition = await this.assessMarketCondition();
      if (marketCondition === "bearish" && isSell) {
        slippage *= 1.2; // Increase slippage in bearish conditions for sells
      }

      // Cap at maximum allowed slippage
      const finalSlippage = Math.min(slippage, this.tradingConfig.slippageSettings.maxSlippage);

      // Convert to basis points
      return Math.floor(finalSlippage * 100);
    } catch (error) {
      console.log("Error calculating dynamic slippage:", error);
      return 100; // Default to 1% slippage
    }
  }

  private async getExpectedAmount(
    tokenAddress: string,
    amount: string,
    walletAddress: string
  ): Promise<string> {
    try {
      // Get quote from Jupiter or other DEX
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=0`;
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        throw new Error(`Quote API error: ${response.status}`);
      }

      const data = await response.json();
      return data.outAmount || "0";
    } catch (error) {
      console.log("Error getting expected amount:", error);
      return "0";
    }
  }

  private calculateVolatility(priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      returns.push(Math.log(priceHistory[i] / priceHistory[i - 1]));
    }

    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private async assessMarketCondition(): Promise<"bullish" | "neutral" | "bearish"> {
    try {
      const solData = await this.dataService.getTokenMarketData(
        "So11111111111111111111111111111111111111112" // SOL address
      );

      if (!solData.priceHistory || solData.priceHistory.length < 24) {
        return "neutral";
      }

      const currentPrice = solData.price;
      const previousPrice = solData.priceHistory[0];
      const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

      if (priceChange > 5) return "bullish";
      if (priceChange < -5) return "bearish";
      return "neutral";
    } catch (error) {
      console.log("Error assessing market condition:", error);
      return "neutral";
    }
  }
} 