import { type IAgentRuntime, logger, ModelTypes, createUniqueUuid, type UUID, type Memory, type Content } from "@elizaos/core";
import type { IToken } from "../types";

export interface TransactionHistory {
  txHash: string;
  blockTime: Date;
  data: any;
}

export interface Portfolio {
  key: string;
  data: any;
}

export interface SentimentContent extends Content {
  text: string;
  source: "sentiment-analysis";
  metadata: {
    timeslot: string;
    processed: boolean;
    occuringTokens?: Array<{
      token: string;
      sentiment: number;
      reason: string;
    }>;
  };
}

const rolePrompt = "You are a sentiment analyzer for cryptocurrency and market data.";

const template = `Write a summary of what is happening in the tweets. The main topic is the cryptocurrency market.
You will also be analyzing the tokens that occur in the tweet and tell us whether their sentiment is positive or negative.

## Analyze the followings tweets:
{{tweets}}

Strictly return the following json:

{
   "text":"the summary of what has happened in those tweets, with a max length of 200 characters",
   "occuringTokens":[
      {
         "token":"the token symbol, like: ETH, SOL, BTC etc.",
         "sentiment":"positive is between 1 and 100 and negative is from -1 to -100",
         "reason":"a short sentence explaining the reason for this sentiment score"
      }
   ]
}`;

function makeBulletpointList(array: string[]): string {
  return array.map((a) => ` - ${a}`).join("\n");
}

export default class Birdeye {
  apiKey: string;
  sentimentRoomId: UUID;
  twitterFeedRoomId: UUID;
  runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
    if (!apiKey) {
      throw new Error("Failed to initialize Birdeye provider due to missing API key.");
    }
    this.apiKey = apiKey;
    this.sentimentRoomId = createUniqueUuid(runtime, "sentiment-analysis");
    this.twitterFeedRoomId = createUniqueUuid(runtime, "twitter-feed");
    this.runtime = runtime;
  }

  private async syncWalletHistory() {
    /** Get entire transaction history */
    const options = {
      method: "GET",
      headers: { accept: "application/json", "x-chain": "solana", "X-API-KEY": this.apiKey },
    };

    const publicKey = this.runtime.getSetting("SOLANA_PUBLIC_KEY");

    const res = await fetch(`https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${publicKey}&limit=100`, options);

    const resp = await res.json();
    const data = resp?.data?.solana;

    // Get existing transactions
    const cachedTxs = await this.runtime.databaseAdapter.getCache<TransactionHistory[]>("transaction_history");
    const transactions: TransactionHistory[] = cachedTxs ? cachedTxs : [];

    // Update transactions
    for (const tx of data) {
      const existingIndex = transactions.findIndex(t => t.txHash === tx.txHash);
      const newTx = {
        txHash: tx.txHash,
        blockTime: new Date(tx.blockTime),
        data: tx
      };

      if (existingIndex >= 0) {
        transactions[existingIndex] = newTx;
      } else {
        transactions.push(newTx);
      }
    }

    await this.runtime.databaseAdapter.setCache<TransactionHistory[]>("transaction_history", transactions);

    logger.info(`Updated transaction history with ${data.length} transactions`);
  }

  private async syncWalletPortfolio() {
    /** Get entire portfolio */
    const options = {
      method: "GET",
      headers: { accept: "application/json", "x-chain": "solana", "X-API-KEY": this.apiKey },
    };

    const publicKey = this.runtime.getSetting("SOLANA_PUBLIC_KEY");

    const res = await fetch(`https://public-api.birdeye.so/v1/wallet/token_list?wallet=${publicKey}`, options);

    const resp = await res.json();
    const data = resp?.data;

    // might want to add the SOLANA_PUBLIC_KEY as a suffix to the key
    await this.runtime.databaseAdapter.setCache<Portfolio>("portfolio", { key: "PORTFOLIO", data });
  }

  async syncWallet() {
    await this.syncWalletHistory();
    await this.syncWalletPortfolio();

    return true;
  }

  async syncTrendingTokens(chain: "solana" | "base"): Promise<boolean> {
    const options = {
      method: "GET",
      headers: { accept: "application/json", "x-chain": chain, "X-API-KEY": this.apiKey },
    };

    // Get existing tokens
    const cachedTokens = await this.runtime.databaseAdapter.getCache<IToken[]>(`tokens_${chain}`);
    const tokens: IToken[] = cachedTokens ? cachedTokens : [];

    /** Fetch top 100 in batches of 20 (which is the limit) */
    for (let batch = 0; batch < 5; batch++) {
      const currentOffset = batch * 20;
      const res = await fetch(
        `https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=${currentOffset}&limit=20`,
        options,
      );
      const resp = await res.json();
      const data = resp?.data;
      const last_updated = new Date(data?.updateUnixTime * 1000);
      const newTokens = data?.tokens;

      for (const token of newTokens) {
        const tokenData: IToken = {
          address: token?.address,
          chain: chain,
          provider: "birdeye",
          decimals: token.decimals,
          liquidity: token.liquidity,
          logoURI: token.logoURI,
          name: token.name,
          symbol: token.symbol,
          marketcap: 0,
          volume24hUSD: token.volume24hUSD,
          rank: token.rank,
          price: token.price,
          price24hChangePercent: token.price24hChangePercent,
          last_updated,
        };

        const existingIndex = tokens.findIndex(t => t.provider === "birdeye" && t.rank === token.rank && t.chain === chain);
        if (existingIndex >= 0) {
          tokens[existingIndex] = tokenData;
        } else {
          tokens.push(tokenData);
        }
      }

      /** Add extra delay */
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await this.runtime.databaseAdapter.setCache<IToken[]>(`tokens_${chain}`, tokens);

    logger.info(`Updated ${chain} tokens cache with ${tokens.length} tokens`);

    return true;
  }

  async fillTimeframe() {
    // Get the latest sentiment analysis
    const memories = await this.runtime.messageManager.getMemories({
      roomId: this.sentimentRoomId,
      end: Date.now(),
      count: 1
    });

    const lastMemory = memories[0] as Memory & { content: SentimentContent };
    const lookUpDate = lastMemory?.content?.metadata?.timeslot;

    const start = new Date(lookUpDate || "2025-01-01T00:00:00.000Z");
    start.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Create memories for each timeslot
    for (let day = 0; day <= diff; day++) {
      const now = new Date(start);
      now.setUTCDate(start.getUTCDate() + day);

      for (let hour = 0; hour <= 23; hour++) {
        const timeslot = new Date(now);
        timeslot.setUTCHours(hour, 0, 0, 0);

        const rightNow = new Date();

        if (timeslot > rightNow) {
          break;
        }

        // Create memory for this timeslot
        await this.runtime.messageManager.createMemory({
          id: createUniqueUuid(this.runtime, `sentiment-${timeslot.toISOString()}`),
          userId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          content: {
            text: "",
            source: "sentiment-analysis",
            metadata: {
              timeslot: timeslot.toISOString(),
              processed: false
            }
          },
          roomId: this.sentimentRoomId,
          createdAt: timeslot.getTime()
        });
      }
    }

    logger.info("Filled timeframe slots for sentiment analysis");
  }
}