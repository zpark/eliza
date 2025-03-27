import { type IAgentRuntime, logger } from "@elizaos/core";
import { WalletService } from './walletService';
import { DataService } from './dataService';
import { AnalyticsService } from './analyticsService';
import { type SellSignalMessage } from '../types';
import { TradingConfig } from '../types/trading';
import { calculateVolatility, assessMarketCondition } from "../utils/analyzeTrade";

import { BN, toBN, formatBN } from '../utils/bignumber';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'uuid';

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

  async handleSellSignal(params: any): void {
    const TRADER_SELL_KUMA = this.runtime.getSetting("TRADER_SELL_KUMA");
    if (TRADER_SELL_KUMA) {
      fetch(TRADER_SELL_KUMA).catch((e) => {
        console.error("TRADER_SELL_KUMA err", e);
      });
    }

    console.log('trader dataService got SPARTAN_TRADE_SELL_SIGNAL', params)

    // Create sell signal
    const signal: SellSignalMessage = {
      positionId: uuidv4() as UUID,
      tokenAddress: params.recommend_sell_address,
      // pairId
      amount: params.sell_amount,
      // currentBalance
      // sellRecommenderId
      // walletAddress
      // isSimulation
      // reason
      entityId: "default",
    };

    // FIXME: refactor to a function
    // Add expected out amount based on quote
    // Only try to get expected amount if we have a trade amount
    if (signal.amount) {
      try {
        // Get a quote to determine expected amount
        const quoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${
              signal.tokenAddress
            }&outputMint=So11111111111111111111111111111111111111112&amount=${
              Math.round(signal.amount * 1e9) // amount has to be lamports
            }&slippageBps=0`
        );

        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          signal.expectedOutAmount = quoteData.outAmount;
        }
      } catch (error) {
        logger.warn("Failed to get expected out amount for sell", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // background, no await needed

    // execute sell
    this.executeSell(signal).then(result => {
      console.log('executeSell - result', result)
    })
  }

  async initialize(): Promise<void> {
    logger.info("Initializing sell service");
    this.runtime.registerEvent("SPARTAN_TRADE_SELL_SIGNAL", this.handleSellSignal.bind(this));
  }

  async stop(): Promise<void> {
    this.pendingSells = {};
  }

  async executeSell(signal: SellSignalMessage): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    receivedAmount?: string;
    receivedValue?: string;
  }> {

    const tokenAddress = signal.tokenAddress;

    try {
      if (!signal) {
        throw new Error("No signal data in sell task");
      }

      //const sellAmount = BigInt(signal.amount);
      // string but make number-like for validation
      const sellAmount = toBN(signal.amount); // anything from a small decimal to a really large number

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
          signal.walletAddress,
          slippageBps
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
        const volatility = calculateVolatility(tokenData.priceHistory);
        if (volatility > 0.1) { // High volatility threshold
          slippage *= (1 + volatility);
        }
      }

      // Adjust for market conditions
      const marketCondition = await assessMarketCondition(this.runtime);
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
    walletAddress: string,
    slippageBps: number,
  ): Promise<string> {
    try {
      console.log('getExpectedAmount - slippageBps', slippageBps, 'amount', amount)
      // Get quote from Jupiter or other DEX
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${
          tokenAddress
        }&outputMint=So11111111111111111111111111111111111111112&amount=${
          Math.round(toBN(amount) * 1e9)
        }&slippageBps=${
          slippageBps // do we need to * 10000 here?
        }`;
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
}