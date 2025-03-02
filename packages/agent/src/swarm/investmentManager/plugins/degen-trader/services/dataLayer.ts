import { logger } from "@elizaos/core";

interface TokenRecommendation {
  recommended_buy: string;
  recommend_buy_address: string;
  reason: string;
  marketcap: number;
  buy_amount: number;
}

export class DataLayer {
  private static readonly SIGNAL_API_URL = "https://api-production-dc40.up.railway.app/signal";

  static async getTokenRecommendation(): Promise<TokenRecommendation> {
    try {
      const response = await fetch(this.SIGNAL_API_URL, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      logger.info('Received token recommendation from API:', data);

      return data as TokenRecommendation;
    } catch (error) {
      logger.error('Failed to fetch token recommendation:', error);
      throw error;
    }
  }
}