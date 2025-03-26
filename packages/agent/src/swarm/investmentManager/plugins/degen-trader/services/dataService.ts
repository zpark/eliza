import { type IAgentRuntime, logger } from "@elizaos/core";
import { CacheManager } from '../utils/cacheManager';
import { PortfolioStatus, TokenSignal } from '../types/trading';
import { getWalletBalance } from "../utils/wallet";

export class DataService {
  private cacheManager: CacheManager;
  private runtime;

  constructor(private runtime: IAgentRuntime) {
    this.cacheManager = new CacheManager();
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    // Initialize any necessary data connections
    logger.info("Initializing data service");
  }

  async stop(): Promise<void> {
    // Clean up any connections
    await this.cacheManager.clear();
  }

  async getBirdeyeSignals(): Promise<TokenSignal[]> {
    try {
      // Get trending tokens from cache (updated by degen-intel service)
      const trendingTokens = await this.runtime.databaseAdapter.getCache<any[]>("birdeye_trending_tokens") || [];

      return Promise.all(
        trendingTokens.map(async (token) => {
          const marketData = await this.getTokenMarketData(token.address);
          return {
            address: token.address,
            symbol: token.symbol,
            marketCap: marketData.marketCap,
            volume24h: marketData.volume24h,
            price: marketData.price,
            liquidity: marketData.liquidity,
            score: 0, // Will be calculated later
            reasons: [`Trending on Birdeye with ${marketData.volume24h}$ 24h volume`],
            technicalSignals: await this.calculateTechnicalSignals(marketData),
          };
        })
      );
    } catch (error) {
      console.log("Error getting Birdeye signals:", error);
      return [];
    }
  }

  async getTwitterSignals(): Promise<TokenSignal[]> {
    try {
      const twitterSignals = await this.runtime.databaseAdapter.getCache<any[]>("twitter_parsed_signals") || [];

      return twitterSignals.map((signal) => ({
        address: signal.tokenAddress,
        symbol: signal.symbol,
        marketCap: signal.marketCap,
        volume24h: signal.volume24h,
        price: signal.price,
        liquidity: signal.liquidity,
        score: 0,
        reasons: [`High social activity: ${signal.mentionCount} mentions`],
        socialMetrics: {
          mentionCount: signal.mentionCount,
          sentiment: signal.sentiment,
          influencerMentions: signal.influencerMentions,
        },
      }));
    } catch (error) {
      console.log("Error getting Twitter signals:", error);
      return [];
    }
  }

  async getCMCSignals(): Promise<TokenSignal[]> {
    try {
      const cmcTokens = await this.runtime.databaseAdapter.getCache<any[]>("cmc_trending_tokens") || [];

      return cmcTokens.map(token => ({
        address: token.address,
        symbol: token.symbol,
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        price: token.price,
        liquidity: token.liquidity,
        score: 0,
        reasons: [`Trending on CMC: ${token.cmcRank} rank`],
        cmcMetrics: {
          rank: token.cmcRank,
          priceChange24h: token.priceChange24h,
          volumeChange24h: token.volumeChange24h
        }
      }));
    } catch (error) {
      console.log("Error getting CMC signals:", error);
      return [];
    }
  }

  async getTokenMarketData(tokenAddress: string): Promise<{
    price: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceHistory: number[];
    volumeHistory: number[];
  }> {
    const cacheKey = `market_data_${tokenAddress}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const apiKey = process.env.BIRDEYE_API_KEY;
      if (!apiKey) {
        throw new Error("Birdeye API key not found");
      }

      console.log('getTokenMarketData for', tokenAddress)

      // call all 3 in parallel
      const [response, volResponse, priceHistoryResponse] = await Promise.all([
        fetch(
          //`https://api.birdeye.so/v1/token/price?address=${tokenAddress}`,
          `https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenAddress}`,
          {
            headers: {
              accept: "application/json",
              "x-CHAIN": "solana",
              "X-API-KEY": apiKey ,
            }
          }
        ),
        fetch(
          `https://public-api.birdeye.so/defi/price_volume/single?address=${tokenAddress}&type=24h`,
          {
            headers: {
              accept: "application/json",
              "x-CHAIN": "solana",
              "X-API-KEY": apiKey ,
            }
          }
        ),
        fetch(
          //`https://api.birdeye.so/v1/token/price_history?address=${tokenAddress}&type=hour&limit=24`,
          `https://public-api.birdeye.so/defi/history_price?address=${tokenAddress}&address_type=token&type=15m`,
          {
            headers: {
              accept: "application/json",
              "x-CHAIN": "solana",
              "X-API-KEY": apiKey ,
            }
          }
        ),
      ]);

      if (!response.ok) {
        throw new Error(`Birdeye response ${tokenAddress} API error: ${response.status}`);
      }
      if (!volResponse.ok) {
        throw new Error(`Birdeye volResponse ${tokenAddress} API error: ${volResponse.status}`);
      }
      if (!priceHistoryResponse.ok) {
        throw new Error(`Birdeye priceHistoryResponse ${tokenAddress} API error: ${priceHistoryResponse.status}`);
      }

      const data = await response.json();
      //console.log('birdeye token market-data data', data, 'for', tokenAddress)

      const volData = await volResponse.json();
      //console.log('birdeye token vol data', volData, 'for', tokenAddress)

      const priceHistoryData = await priceHistoryResponse.json();
      //console.log('priceHistoryData', priceHistoryData, 'for', tokenAddress)

      if (!data.data) {
        console.warn('getTokenMarketData - cant save result'. data, 'for', tokenAddress)
        return {}
      }
      // FIXME: volData.data check
      // FIXME: priceHistoryData.data
      const result = {
        price: data.data.price, //was value
        marketCap: data.data.market_cap || 0, // was marketCap
        liquidity: data.data.liquidity || 0,
        //volume24h: data.data.volume24h || 0,
        volume24h: volData.data.volumeUSD || 0,
        priceHistory: priceHistoryData.data.items.map((item: any) => item.value),
        // not used
        //volumeHistory: historyData.data.items.map((item: any) => item.volume || 0)
      };

      console.log('getTokenMarketData - saving result'. result, 'for', tokenAddress)
      await this.cacheManager.set(cacheKey, result, 60000);
      return result;
    } catch (error) {
      console.log("Error fetching token market data:", error);
      return {
        price: 0,
        marketCap: 0,
        liquidity: 0,
        volume24h: 0,
        priceHistory: [],
        volumeHistory: []
      };
    }
  }

  private async calculateTechnicalSignals(marketData: any) {
    // Implementation of technical analysis calculations
    // This would include RSI, MACD, etc. calculations
    return {
      rsi: 0, // Placeholder
      macd: {
        value: 0,
        signal: 0,
        histogram: 0,
      },
      volumeProfile: {
        trend: "stable" as const,
        unusualActivity: false,
      },
      volatility: 0,
    };
  }

  async getTokenRecommendation(): Promise<{
    recommended_buy: string;
    recommend_buy_address: string;
    reason: string;
    marketcap: number;
    buy_amount: number;
  }> {
    try {
      logger.info("Getting token recommendations from multiple sources");

      // Get signals from different sources
      const [birdeyeSignals, twitterSignals, cmcSignals] = await Promise.all([
        this.getBirdeyeSignals(),
        this.getTwitterSignals(),
        this.getCMCSignals(),
      ]);

      // Combine and score signals
      const scoredTokens = await this.scoreTokenSignals([
        ...birdeyeSignals,
        ...twitterSignals,
        ...cmcSignals,
      ]);

      if (scoredTokens.length === 0) {
        logger.warn("No suitable tokens found, defaulting to SOL");
        return {
          recommended_buy: "SOL",
          recommend_buy_address: "So11111111111111111111111111111111111111112",
          reason: "Fallback to SOL - no other tokens met criteria",
          marketcap: 0,
          buy_amount: 0.1,
        };
      }

      // Get the highest scored token
      const bestToken = scoredTokens[0];

      // Validate token before recommending
      const validation = await this.validateTokenForTrading(bestToken.address);
      if (!validation.isValid) {
        logger.warn("Best token failed validation", validation);
        return this.getDefaultRecommendation();
      }

      return {
        recommended_buy: bestToken.symbol,
        recommend_buy_address: bestToken.address,
        reason: bestToken.reasons.join(", "),
        marketcap: bestToken.marketCap,
        buy_amount: await this.calculateOptimalBuyAmount(bestToken),
      };
    } catch (error) {
      console.log("Failed to get token recommendation:", error);
      return this.getDefaultRecommendation();
    }
  }

  private async scoreTokenSignals(signals: TokenSignal[]): Promise<TokenSignal[]> {
    // Group signals by token address
    const tokenMap = new Map<string, TokenSignal>();

    for (const signal of signals) {
      if (tokenMap.has(signal.address)) {
        const existing = tokenMap.get(signal.address)!;
        existing.reasons.push(...signal.reasons);
        existing.score += signal.score;
      } else {
        tokenMap.set(signal.address, signal);
      }
    }

    // Score each token
    const scoredTokens = Array.from(tokenMap.values()).map((token) => {
      let score = 0;

      // Technical Analysis Score (0-40)
      if (token.technicalSignals) {
        score += this.scoreTechnicalSignals(token.technicalSignals);
      }

      // Social Signal Score (0-30)
      if (token.socialMetrics) {
        score += this.scoreSocialMetrics(token.socialMetrics);
      }

      // Market Metrics Score (0-30)
      score += this.scoreMarketMetrics({
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        liquidity: token.liquidity,
      });

      token.score = score;
      return token;
    });

    // Sort by score and filter minimum requirements
    return scoredTokens
      .filter(
        (token) =>
          token.score >= 60 && // Minimum score requirement
          token.liquidity >= 50000 && // Minimum liquidity $50k
          token.volume24h >= 100000 // Minimum 24h volume $100k
      )
      .sort((a, b) => b.score - a.score);
  }

  private getDefaultRecommendation() {
    return {
      recommended_buy: "SOL",
      recommend_buy_address: "So11111111111111111111111111111111111111112",
      reason: "Default recommendation",
      marketcap: 0,
      buy_amount: 0.1,
    };
  }

  async getPortfolioStatus(): Promise<PortfolioStatus> {
    try {
      const walletBalance = await getWalletBalance(this.runtime);
      const positions = await this.getPositions();
      const totalValue = walletBalance + Object.values(positions)
        .reduce((sum, pos) => sum + pos.value, 0);

      const drawdown = await this.calculateDrawdown({
        totalValue,
        positions,
        solBalance: walletBalance
      });

      return {
        totalValue,
        positions,
        solBalance: walletBalance,
        drawdown
      };
    } catch (error) {
      console.log("Error getting portfolio status:", error);
      throw error;
    }
  }

  async validateTokenForTrading(tokenAddress: string): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      // Get token market data
      const marketData = await this.getTokenMarketData(tokenAddress);

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

      return { isValid: true };
    } catch (error) {
      console.log("Error validating token for trading:", error);
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async calculateOptimalBuyAmount(token: TokenSignal): Promise<number> {
    try {
      // Get wallet balance
      const walletBalance = await getWalletBalance(this.runtime);

      // Get portfolio status to check current exposure
      const portfolio = await this.getPortfolioStatus();

      // Calculate available capital based on max drawdown limit
      const availableCapital =
        walletBalance *
        (1 - portfolio.drawdown / this.tradingConfig.riskLimits.maxDrawdown);

      // Skip if we're already at max drawdown
      if (availableCapital <= 0) {
        logger.warn("Max drawdown reached, skipping trade", {
          drawdown: portfolio.drawdown,
          maxDrawdown: this.tradingConfig.riskLimits.maxDrawdown,
        });
        return 0;
      }

      // Base percentage based on score
      const basePercentage = Math.min(
        token.score / 200, // 0.3 to 0.5 for scores 60-100
        this.tradingConfig.riskLimits.maxPositionSize
      );

      return Math.min(availableCapital * basePercentage, token.liquidity * 0.02);
    } catch (error) {
      console.log("Error calculating optimal buy amount:", error);
      return 0;
    }
  }

  async getMonitoredTokens(): Promise<string[]> {
    try {
      // Get all tasks with EXECUTE_SELL tag
      const tasks = await this.runtime.databaseAdapter.getTasks({
        tags: ["degen_trader"],
        name: "EXECUTE_SELL"
      });

      // Extract unique token addresses from tasks
      const tokenAddresses = new Set<string>();
      tasks.forEach(task => {
        if (task.metadata?.signal?.tokenAddress) {
          tokenAddresses.add(task.metadata.signal.tokenAddress);
        }
      });

      return Array.from(tokenAddresses);
    } catch (error) {
      console.log("Error getting monitored tokens:", error);
      return [];
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      // Get list of tokens we're monitoring
      const monitoredTokens = await this.getMonitoredTokens();

      if (!monitoredTokens.length) {
        return [];
      }

      // Get positions for each token
      const positions = await Promise.all(
        monitoredTokens.map(async (tokenAddress) => {
          try {
            const balance = await this.walletService.getTokenBalance(tokenAddress);
            const marketData = await this.getTokenMarketData(tokenAddress);

            return {
              tokenAddress,
              balance,
              currentPrice: marketData.price,
              value: balance * marketData.price,
              lastUpdated: new Date().toISOString()
            };
          } catch (error) {
            console.log(`Error getting position for token ${tokenAddress}:`, error);
            return null;
          }
        })
      );

      return positions.filter(position => position !== null);
    } catch (error) {
      console.log("Error getting positions:", error);
      return [];
    }
  }
}