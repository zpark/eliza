import { z } from "zod";

/**
 * Core schema definitions for community-trader plugin
 * This approach provides runtime validation and better type safety
 */

// Define TokenPerformance schema
export const tokenPerformanceSchema = z.object({
  chain: z.string().default("unknown"),
  address: z.string(),
  name: z.string().optional().default(""),
  symbol: z.string(),
  decimals: z.number().default(0),
  metadata: z.record(z.any()).default({}),
  price: z.number().default(0),
  volume: z.number().default(0),
  trades: z.number().default(0),
  liquidity: z.number().default(0),
  holders: z.number().default(0),
  price24hChange: z.number().default(0),
  volume24hChange: z.number().default(0),
  trades24hChange: z.number().default(0),
  holders24hChange: z.number().default(0),
  initialMarketCap: z.number().default(0),
  currentMarketCap: z.number().default(0),
  rugPull: z.boolean().default(false),
  isScam: z.boolean().default(false),
  sustainedGrowth: z.boolean().default(false),
  rapidDump: z.boolean().default(false),
  suspiciousVolume: z.boolean().default(false),
  validationTrust: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

// Define Transaction schema
export const transactionSchema = z.object({
  id: z.string(),
  positionId: z.string(),
  chain: z.string().default("unknown"),
  tokenAddress: z.string(),
  transactionHash: z.string(),
  type: z.enum(["buy", "sell"]),
  amount: z.number(),
  price: z.number(),
  isSimulation: z.boolean().default(false),
  timestamp: z.union([z.date(), z.string()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  )
});

// Define Recommender schema
export const recommenderSchema = z.object({
  id: z.string(),
  platform: z.string().default("unknown"),
  userId: z.string().optional(),
  username: z.string().optional().default("unknown"),
  address: z.string().optional(),
  solanaPubkey: z.string().optional(),
  telegramId: z.string().optional(),
  discordId: z.string().optional(),
  twitterId: z.string().optional(),
  ip: z.string().optional()
});

// Define RecommenderMetrics schema
export const recommenderMetricsSchema = z.object({
  recommenderId: z.string(),
  trustScore: z.number(),
  totalRecommendations: z.number(),
  successfulRecs: z.number(),
  avgTokenPerformance: z.number(),
  riskScore: z.number(),
  consistencyScore: z.number(),
  virtualConfidence: z.number(),
  lastActiveDate: z.date(),
  trustDecay: z.number(),
  updatedAt: z.date().optional().default(() => new Date())
});

// Types derived from schemas
export type TokenPerformance = z.infer<typeof tokenPerformanceSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Recommender = z.infer<typeof recommenderSchema>;
export type RecommenderMetrics = z.infer<typeof recommenderMetricsSchema>;

/**
 * Transform functions to convert database objects to schema-validated objects
 */

export function transformTokenPerformance(dbToken: any, chain: string = "unknown"): TokenPerformance {
  const input = {
    chain,
    address: dbToken.tokenAddress || dbToken.token_address,
    name: dbToken.name || dbToken.symbol,
    symbol: dbToken.symbol,
    price: 0,
    volume: 0,
    trades: 0,
    liquidity: dbToken.liquidity,
    holders: 0,
    price24hChange: dbToken.priceChange24h || dbToken.price_change_24h,
    volume24hChange: dbToken.volumeChange24h || dbToken.volume_change_24h,
    trades24hChange: dbToken.trade_24h_change,
    holders24hChange: dbToken.holderChange24h || dbToken.holder_change_24h,
    initialMarketCap: dbToken.initialMarketCap || dbToken.initial_market_cap || 0,
    currentMarketCap: 0,
    rugPull: Boolean(dbToken.rugPull || dbToken.rug_pull),
    isScam: Boolean(dbToken.isScam || dbToken.is_scam),
    sustainedGrowth: Boolean(dbToken.sustainedGrowth || dbToken.sustained_growth),
    rapidDump: Boolean(dbToken.rapidDump || dbToken.rapid_dump),
    suspiciousVolume: Boolean(dbToken.suspiciousVolume || dbToken.suspicious_volume),
    validationTrust: dbToken.validationTrust || dbToken.validation_trust || 0,
    createdAt: new Date(),
    updatedAt: dbToken.lastUpdated || dbToken.last_updated 
      ? new Date(dbToken.lastUpdated || dbToken.last_updated)
      : new Date()
  };
  
  return tokenPerformanceSchema.parse(input);
}

export function transformTransaction(dbTx: any, positionId: string = "unknown", chain: string = "unknown"): Transaction {
  const input = {
    id: dbTx.id || dbTx.transactionHash || dbTx.transaction_hash,
    positionId: dbTx.positionId || dbTx.position_id || positionId,
    chain: dbTx.chain || chain,
    tokenAddress: dbTx.tokenAddress || dbTx.token_address,
    transactionHash: dbTx.transactionHash || dbTx.transaction_hash,
    type: dbTx.type,
    amount: dbTx.amount,
    price: dbTx.price,
    isSimulation: Boolean(dbTx.isSimulation || dbTx.is_simulation),
    timestamp: dbTx.timestamp
  };
  
  return transactionSchema.parse(input);
}

export function transformRecommender(dbRec: any): Recommender {
  const input = {
    id: dbRec.id,
    platform: dbRec.platform || "unknown",
    userId: dbRec.userId || dbRec.user_id || 
      dbRec.telegramId || dbRec.telegram_id || 
      dbRec.discordId || dbRec.discord_id || 
      dbRec.twitterId || dbRec.twitter_id,
    username: dbRec.username || "unknown",
    address: dbRec.address,
    solanaPubkey: dbRec.solanaPubkey || dbRec.solana_pubkey,
    telegramId: dbRec.telegramId || dbRec.telegram_id,
    discordId: dbRec.discordId || dbRec.discord_id,
    twitterId: dbRec.twitterId || dbRec.twitter_id,
    ip: dbRec.ip
  };
  
  return recommenderSchema.parse(input);
}

/**
 * Cache utilities
 */
export class CacheManager {
  private runtime: any;
  private ttl: number;
  
  constructor(runtime: any, ttlSeconds: number = 300) {
    this.runtime = runtime;
    this.ttl = ttlSeconds;
  }
  
  async getTokenPerformance(chain: string, address: string): Promise<TokenPerformance | null> {
    const cacheKey = `token:${chain}:${address}`;
    const cached = await this.getFromCache(cacheKey);
    
    if (cached) {
      // Add schema validation when retrieving from cache
      try {
        return tokenPerformanceSchema.parse(cached);
      } catch (error) {
        // If validation fails, return null and let the caller handle fetching fresh data
        console.error("Cache validation failed for token performance:", error);
        return null;
      }
    }
    
    return null;
  }
  
  async cacheTokenPerformance(token: TokenPerformance): Promise<void> {
    const cacheKey = `token:${token.chain}:${token.address}`;
    await this.setInCache(cacheKey, token);
  }
  
  async getRecommender(platform: string, userId?: string): Promise<Recommender | null> {
    const cacheKey = `recommender:${platform}:${userId || "unknown"}`;
    const cached = await this.getFromCache(cacheKey);
    
    if (cached) {
      try {
        return recommenderSchema.parse(cached);
      } catch (error) {
        console.error("Cache validation failed for recommender:", error);
        return null;
      }
    }
    
    return null;
  }
  
  async cacheRecommender(recommender: Recommender): Promise<void> {
    if (!recommender.platform) return;
    
    const cacheKey = `recommender:${recommender.platform}:${recommender.userId || "unknown"}`;
    await this.setInCache(cacheKey, recommender);
  }
  
  private async getFromCache(key: string): Promise<any> {
    if (typeof this.runtime.databaseAdapter?.getCache === 'function') {
      try {
        const cached = await this.runtime.databaseAdapter.getCache(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.error(`Error retrieving ${key} from cache:`, error);
      }
    }
    return null;
  }
  
  private async setInCache(key: string, value: any): Promise<void> {
    if (typeof this.runtime.databaseAdapter?.setCache === 'function') {
      try {
        await this.runtime.databaseAdapter.setCache(key, JSON.stringify(value), this.ttl);
      } catch (error) {
        console.error(`Error setting ${key} in cache:`, error);
      }
    }
  }
} 