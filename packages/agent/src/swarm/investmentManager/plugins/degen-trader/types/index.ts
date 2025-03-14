export enum ServiceTypes {
    DEGEN_TRADING = "DEGEN_TRADING"
  }
  
  export interface BuySignalMessage {
    tokenAddress: string;
    symbol: string;
    amount?: string;
    expectedAmount?: string;
    walletAddress: string;
    tradeAmount?: number;
  }
  
  export interface SellSignalMessage {
    tokenAddress: string;
    amount: string;
    currentBalance: string;
    walletAddress: string;
  }
  
  export interface PriceSignalMessage {
    tokenAddress: string;
    price: number;
    timestamp: number;
  } 