import { type IAgentRuntime, logger } from "@elizaos/core";
import { TokenSignal } from '../types/trading';

export class AnalyticsService {
  constructor(private runtime: IAgentRuntime) {}

  async initialize(): Promise<void> {
    logger.info("Initializing analytics service");
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  async scoreTechnicalSignals(signals: TokenSignal['technicalSignals']): Promise<number> {
    if (!signals) return 0;

    let score = 0;

    // RSI Analysis (0-10 points)
    if (signals.rsi) {
      if (signals.rsi < 30) score += 8; // Oversold
      else if (signals.rsi > 70) score += 2; // Overbought
      else score += 5; // Neutral
    }

    // MACD Analysis (0-10 points)
    if (signals.macd) {
      if (signals.macd.histogram > 0 && signals.macd.value > signals.macd.signal) {
        score += 10; // Strong bullish signal
      } else if (signals.macd.histogram > 0) {
        score += 7; // Bullish signal
      } else {
        score += 3; // Bearish signal
      }
    }

    // Volume Profile (0-10 points)
    if (signals.volumeProfile) {
      if (signals.volumeProfile.trend === "increasing") {
        score += 10;
      } else if (signals.volumeProfile.trend === "stable") {
        score += 5;
      }
      if (signals.volumeProfile.unusualActivity) score += 5;
    }

    // Volatility adjustment (-5 to +5 points)
    if (signals.volatility) {
      const volatilityScore = 5 - (signals.volatility * 10);
      score += Math.max(-5, Math.min(5, volatilityScore));
    }

    return score;
  }

  async scoreSocialMetrics(metrics: TokenSignal['socialMetrics']): Promise<number> {
    if (!metrics) return 0;

    let score = 0;

    // Mention count (0-10 points)
    const mentionScore = Math.min(metrics.mentionCount / 100, 10);
    score += mentionScore;

    // Sentiment (-10 to +10 points)
    score += metrics.sentiment * 10;

    // Influencer mentions (0-10 points)
    const influencerScore = Math.min(metrics.influencerMentions * 2, 10);
    score += influencerScore;

    return Math.max(0, score);
  }

  async scoreMarketMetrics(metrics: {
    marketCap: number;
    volume24h: number;
    liquidity: number;
  }): Promise<number> {
    let score = 0;

    // Market cap score (0-10 points)
    if (metrics.marketCap > 1000000000) score += 2; // >$1B
    else if (metrics.marketCap > 100000000) score += 5; // >$100M
    else if (metrics.marketCap > 10000000) score += 10; // >$10M
    else score += 3; // <$10M

    // Volume score (0-10 points)
    const volumeToMcap = metrics.volume24h / metrics.marketCap;
    score += Math.min(volumeToMcap * 100, 10);

    // Liquidity score (0-10 points)
    const liquidityToMcap = metrics.liquidity / metrics.marketCap;
    score += Math.min(liquidityToMcap * 100, 10);

    return score;
  }

  async trackSlippageImpact(
    tokenAddress: string,
    expectedAmount: string,
    actualAmount: string,
    slippageBps: number,
    isSell: boolean
  ): Promise<void> {
    try {
      const expected = Number(expectedAmount);
      const actual = Number(actualAmount);

      if (expected <= 0 || actual <= 0) {
        logger.warn('Invalid amounts for slippage tracking', {
          tokenAddress,
          expectedAmount,
          actualAmount
        });
        return;
      }

      const actualSlippage = ((expected - actual) / expected) * 100;
      const actualSlippageBps = Math.floor(actualSlippage * 100);

      await this.runtime.databaseAdapter.setCache(`slippage_impact:${tokenAddress}:${Date.now()}`, {
        tokenAddress,
        timestamp: new Date().toISOString(),
        expectedAmount,
        actualAmount,
        slippageBpsUsed: slippageBps,
        actualSlippageBps,
        isSell
      });

      logger.info('Trade slippage impact tracked', {
        tokenAddress,
        slippageBpsUsed: slippageBps,
        actualSlippageBps,
        efficiency: actualSlippageBps / slippageBps
      });
    } catch (error) {
      logger.error('Error tracking slippage impact', error);
    }
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) {
      return 50; // Default neutral value
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI using smoothed averages
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }
    }

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateMACD(prices: number[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const shortPeriod = 12;
    const longPeriod = 26;
    const signalPeriod = 9;

    if (prices.length < longPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calculate EMAs
    const shortEMA = this.calculateEMA(prices, shortPeriod);
    const longEMA = this.calculateEMA(prices, longPeriod);

    // Calculate MACD line
    const macdLine = shortEMA - longEMA;

    // Calculate signal line (9-day EMA of MACD line)
    const signalLine = this.calculateEMA([macdLine], signalPeriod);

    // Calculate histogram
    const histogram = macdLine - signalLine;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram,
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1];
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }
} 