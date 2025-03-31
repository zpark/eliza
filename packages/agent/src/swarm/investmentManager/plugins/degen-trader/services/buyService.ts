import { type IAgentRuntime, logger, ServiceTypes } from "@elizaos/core";
import { WalletService } from './walletService';
import { DataService } from './dataService';
import { AnalyticsService } from './analyticsService';
import { type BuySignalMessage } from '../types';
import { TradingConfig } from '../types/trading';
import { calculateVolatility, assessMarketCondition } from "../utils/analyzeTrade";
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'uuid';

export class BuyService {
  private tradingConfig: TradingConfig;

  constructor(
    private runtime: IAgentRuntime,
    protected walletService: WalletService,
    protected dataService: DataService,
    protected analyticsService: AnalyticsService
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

  private async handleBuySignal(params: any): void {
    const TRADER_BUY_KUMA = this.runtime.getSetting("TRADER_BUY_KUMA");
    if (TRADER_BUY_KUMA) {
      fetch(TRADER_BUY_KUMA).catch((e) => {
        console.error("TRADER_BUY_KUMA err", e);
      });
    }

    console.log('trader dataService got SPARTAN_TRADE_BUY_SIGNAL', params)
    /*
    trader dataService got SPARTAN_TRADE_BUY_SIGNAL {
      recommended_buy: 'Jupiter',
      recommend_buy_address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      reason: 'Jupiter is both trending and has a positive sentiment score, indicating strong market interest and potential for growth. Given your balance of 0.088209662 SOL, a buy amount of 0.05 SOL allows you to participate in the potential upside while managing risk effectively.',
      buy_amount: '0.05',
      marketcap: NaN
    }
    */

    // buyService.generateBuySignal makes a taskService.BUY_TASK
    // taskService.BUY_TASK calls (was task)buyService.executeBuyTask call buyService.handleBuySignal
    // buyService.handleBuySignal is the final step and does the wallet tx to BUY

    // Create buy signal
    const signal: BuySignalMessage = {
      positionId: uuidv4() as UUID,
      tokenAddress: params.recommend_buy_address,
      entityId: "default",
      tradeAmount: params.buy_amount,
      expectedOutAmount: "0",
    };

    // Add expected out amount based on quote
    // Only try to get expected amount if we have a trade amount
    if (signal.tradeAmount) {
      try {
        // Get a quote to determine expected amount
        const quoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${
            signal.tokenAddress
          }&amount=${
            Math.round(Number(signal.tradeAmount) * 1e9)
          }&slippageBps=0`
        );

        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          signal.expectedOutAmount = quoteData.outAmount;
        }
      } catch (error) {
        logger.warn("Failed to get expected out amount for buy", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // background, no await needed
    this.executeBuy(signal).then(result => {
      console.log('executeBuy - result', result)
    })
  }

  async initialize(): Promise<void> {
    logger.info("Initializing buy service");

    // event vs task
    // fg vs bg?
    // going to use events for now, we'll worry about background later
    this.runtime.registerEvent("SPARTAN_TRADE_BUY_SIGNAL", this.handleBuySignal.bind(this));
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  private async executeBuy(signal: BuySignalMessage): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    outAmount?: string;
    swapUsdValue?: string;
  }>  {
    try {
      if (!signal) {
        throw new Error("No signal data in buy task");
      }

      /*
      const result = await this.handleBuySignal({
        ...signal,
        tradeAmount: tradeAmount || 0
      });
      */

      // Validate token before trading
      const validation = await this.validateTokenForTrading(signal.tokenAddress);
      if (!validation.isValid) {
        return { success: false, error: validation.reason };
      }

      // Calculate optimal buy amount
      const walletBalance = await this.walletService.getBalance();
      const buyAmount = await this.calculateOptimalBuyAmount({
        tokenAddress: signal.tokenAddress,
        walletBalance,
        signal,
      });

      if (buyAmount <= 0) {
        return { success: false, error: "Buy amount too small" };
      }

      // Calculate dynamic slippage
      const slippageBps = await this.calculateDynamicSlippage(
        signal.tokenAddress,
        buyAmount,
        false
      );

      // Get wallet instance
      const wallet = await this.walletService.getWallet();

      // Execute buy
      const result = await wallet.buy({
        tokenAddress: signal.tokenAddress,
        amountInSol: buyAmount,
        slippageBps,
      });

      if (result.success && result.outAmount) {
        await this.analyticsService.trackSlippageImpact(
          signal.tokenAddress,
          signal.expectedOutAmount || "0",
          result.outAmount,
          slippageBps,
          false
        );
      }

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
      console.log("Error executing buy task:", error)
      //logger.error("Error executing buy task:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async validateTokenForTrading(tokenAddress: string): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      // Get token market data
      const marketData = await this.dataService.getTokenMarketData(tokenAddress);

      console.log('marketData', marketData)

      // Check if token has sufficient liquidity
      if (marketData.liquidity < this.tradingConfig.thresholds.minLiquidity) {
        return {
          isValid: false,
          reason: `Insufficient liquidity: ${marketData.liquidity} < ${this.tradingConfig.thresholds.minLiquidity}`,
        };
      }

      // Check if token has sufficient volume
      if (marketData.volume24h < this.tradingConfig.thresholds.minVolume) {
        return {
          isValid: false,
          reason: `Insufficient 24h volume: ${marketData.volume24h} < ${this.tradingConfig.thresholds.minVolume}`,
        };
      }

      // Fetch token metadata
      const tokenMetadata = await this.fetchTokenMetadata(tokenAddress);

      // Additional validations
      if (!tokenMetadata.verified) {
        return { isValid: false, reason: "Token is not verified" };
      }

      if (tokenMetadata.suspiciousAttributes.length > 0) {
        return {
          isValid: false,
          reason: `Suspicious attributes: ${tokenMetadata.suspiciousAttributes.join(", ")}`,
        };
      }

      return { isValid: true };
    } catch (error) {
      console.log("Error validating token:", error);
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async calculateOptimalBuyAmount({
    tokenAddress,
    walletBalance,
    signal,
  }: {
    tokenAddress: string;
    walletBalance: number;
    signal: BuySignalMessage;
  }): Promise<number> {
    try {
      // Get token data
      const tokenData = await this.dataService.getTokenMarketData(tokenAddress);

      // Calculate base position size based on wallet balance and risk limits
      const maxPosition = walletBalance * this.tradingConfig.riskLimits.maxPositionSize;

      // Adjust for volatility
      let adjustedAmount = maxPosition;
      if (tokenData.priceHistory) {
        const volatility = calculateVolatility(tokenData.priceHistory);
        const volatilityFactor = Math.max(0.5, 1 - volatility);
        adjustedAmount *= volatilityFactor;
      }

      // Adjust for market conditions
      const marketCondition = await assessMarketCondition(this.runtime);
      if (marketCondition === "bearish") {
        adjustedAmount *= 0.5;
      }

      // Ensure we don't exceed liquidity constraints
      const maxLiquidityImpact = tokenData.liquidity * 0.02; // Max 2% of liquidity
      const finalAmount = Math.min(adjustedAmount, maxLiquidityImpact);

      // Ensure minimum trade size
      const minTradeSize = 0.05; // Minimum 0.05 SOL
      return Math.max(minTradeSize, finalAmount);
    } catch (error) {
      console.log("Error calculating optimal buy amount:", error);
      return 0;
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

      // Adjust for volume
      const volumeToMcapRatio = tokenData.volume24h / tokenData.marketCap;
      if (volumeToMcapRatio > 0.05) {
        const volumeDiscount = Math.min(volumeToMcapRatio * 5, 0.5) * this.tradingConfig.slippageSettings.volumeMultiplier;
        slippage = Math.max(slippage - volumeDiscount, this.tradingConfig.slippageSettings.baseSlippage * 0.5);
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

  private async fetchTokenMetadata(tokenAddress: string): Promise<{
    verified: boolean;
    suspiciousAttributes: string[];
    ownershipConcentration: number;
  }> {
    // Implementation from previous code...
    // This would fetch token metadata from your preferred source

    // not from rabbi-trader
    // FIXME: find the birdeye call that does a security check
    // suspiciousAttributes
    console.log('fetchTokenMetadata write me!')
    return {
      verified: true,
      suspiciousAttributes: [],
      ownershipConcentration: 0,
    };
  }

  private async analyzeTradingAmount({
    walletBalance,
    tokenAddress,
    defaultPercentage = 0.1,
  }: {
    walletBalance: number;
    tokenAddress: string;
    defaultPercentage?: number;
  }): Promise<number> {
    try {
      // Log input parameters
      logger.info("Starting trade analysis with:", {
        walletBalance,
        tokenAddress,
        defaultPercentage,
      });

      // Get token recommendation from data service
      const tokenRecommendation = await this.dataService.getTokenRecommendation();

      // ... rest of the analysis logic ...
      const suggestedAmount = tokenRecommendation.buy_amount || walletBalance * defaultPercentage;

      logger.info("Final suggested amount:", { suggestedAmount });
      return Math.min(suggestedAmount, walletBalance);
    } catch (error) {
      console.log("Trade analysis failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return walletBalance * defaultPercentage;
    }
  }

  public getWalletService() {
    return this.walletService;
  }

  public getDataService() {
    return this.dataService;
  }

  public getAnalyticsService() {
    return this.analyticsService;
  }

}