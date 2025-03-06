export const PROVIDER_CONFIG = {
  ORCA_API: "https://api.orca.so",
  POSITION_ENDPOINT: "/v2/positions",
  POOL_STATS_ENDPOINT: "/v2/pools",
  PRICE_FEED_ENDPOINT: "/v2/prices",
  
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};

// Add configuration for enabled chains
export const CHAIN_CONFIG = {
  SOLANA_ENABLED: true,
};

// Add Solana chain configuration
export const SOLANA_CONFIG = {
  RPC_URL: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  ORCA: {
    WHIRLPOOL_PROGRAM_ID: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  },
};

// Add required settings configuration
export const REQUIRED_SETTINGS = {
  SOLANA_PUBLIC_KEY: "Public key of the LP wallet",
  SOLANA_PRIVATE_KEY: "Private key of the LP wallet"
};

export const SAFETY_LIMITS = {
  MIN_POSITION_SIZE: 100, // Minimum position size in USD
  MAX_POSITION_SIZE: 10000, // Maximum position size in USD
  MAX_SLIPPAGE: 100, // 1% in basis points
  MIN_TVL: 100000, // Minimum pool TVL
  MIN_VOLUME_24H: 10000, // Minimum 24h volume
  MAX_PRICE_IMPACT: 100, // 1% in basis points
};

export const LP_CONFIG = {
  REBALANCE_THRESHOLD: 200, // 2% price deviation in basis points
  TARGET_RANGE_WIDTH: 1000, // 10% range width in basis points
  MIN_TIME_BETWEEN_REBALANCE: 3600, // 1 hour in seconds
  GAS_PRIORITY: "HIGH", // LOW, MEDIUM, HIGH
}; 