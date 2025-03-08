import { elizaLogger, IAgentRuntime, Memory, Provider, settings, State } from "@elizaos/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadWallet } from "../../utils/loadWallet";

export interface FetchedPositionStatistics {
  poolId: string;
  positionMint: string;
  inRange: boolean;
  distanceCenterPositionFromPoolPriceBps: number;
  positionWidthBps: number;
  liquidity: number;
  tokenAmounts: {
    tokenA: number;
    tokenB: number;
  };
  fees: {
    tokenA: number;
    tokenB: number;
  };
  apr: number;
}

interface RaydiumApiResponse<T> {
  id: string;
  success: boolean;
  data: T;
  msg?: string;
}

interface PoolInfo {
  id: string;
  mint: string;
  price: number;
  liquidity: number;
  tokenA: {
    mint: string;
    vault: string;
    decimals: number;
  };
  tokenB: {
    mint: string;
    vault: string;
    decimals: number;
  };
  fees24h: number;
  volume24h: number;
  apr24h: number;
  positions?: {
    mint: string;
    liquidity: number;
    tokenAmounts: {
      tokenA: number;
      tokenB: number;
    };
    fees: {
      tokenA: number;
      tokenB: number;
    };
    inRange: boolean;
    priceLower: number;
    priceUpper: number;
  }[];
}

export const positionProvider: Provider = {
  name: "degen-lp-raydium-position-provider",
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<string | null> => {
    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.updateRecentMessageState(state);
    }

    try {
      const { address: ownerAddress } = await loadWallet(runtime, false);
      const connection = new Connection(settings.SOLANA_RPC_URL!);
      const positions = await fetchPositions(connection, ownerAddress);
      return JSON.stringify(positions);
    } catch (error) {
      elizaLogger.error("Error in Raydium position provider:", error);
      return null;
    }
  },
};

async function fetchPositions(
  connection: Connection, 
  ownerAddress: string
): Promise<FetchedPositionStatistics[]> {
  try {
    // First get all concentrated pools
    const poolsResponse = await fetchFromRaydiumApi<PoolInfo[]>(
      '/pools/info/list',
      {
        poolType: 'concentrated',
        poolSortField: 'liquidity',
        sortType: 'desc',
        pageSize: 100,
        page: 1
      }
    );

    // Filter pools to only those where owner has positions
    const positionsPromises = poolsResponse.map(async (pool) => {
      const positionLine = await fetchFromRaydiumApi<{
        count: number;
        line: { price: number; tick: number; liquidity: number }[];
      }>('/pools/line/position', { id: pool.id });

      // Find positions owned by this address
      const ownerPositions = (pool.positions || []).filter(pos => {
        try {
          return new PublicKey(pos.mint).toBase58() === ownerAddress;
        } catch {
          return false;
        }
      });

      return ownerPositions.map(position => {
        const currentPrice = pool.price;
        const priceLower = position.priceLower;
        const priceUpper = position.priceUpper;
        
        // Calculate distance from center in bps
        const distanceBps = Math.abs((currentPrice - ((priceLower + priceUpper) / 2)) / currentPrice * 10000);
        
        // Calculate position width in bps
        const widthBps = ((priceUpper - priceLower) / ((priceLower + priceUpper) / 2)) * 10000;

        return {
          poolId: pool.id,
          positionMint: position.mint,
          inRange: position.inRange,
          distanceCenterPositionFromPoolPriceBps: distanceBps,
          positionWidthBps: widthBps,
          liquidity: position.liquidity,
          tokenAmounts: position.tokenAmounts,
          fees: position.fees,
          apr: pool.apr24h
        };
      });
    });

    const allPositions = await Promise.all(positionsPromises);
    return allPositions.flat();

  } catch (error) {
    elizaLogger.error("Error fetching Raydium positions:", error);
    throw new Error("Failed to fetch Raydium positions");
  }
}

async function fetchFromRaydiumApi<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T> {
  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, v.toString()])
  ).toString();

  const url = `${settings.RAYDIUM_API_URL}${endpoint}?${queryString}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Raydium API error: ${response.statusText}`);
  }

  const result = await response.json() as RaydiumApiResponse<T>;
  
  if (!result.success) {
    throw new Error(`Raydium API error: ${result.msg}`);
  }

  return result.data;
} 