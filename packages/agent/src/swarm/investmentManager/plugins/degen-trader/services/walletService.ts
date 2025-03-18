import { type IAgentRuntime, logger } from "@elizaos/core";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export interface WalletOperationResult {
  success: boolean;
  signature?: string;
  error?: string;
  outAmount?: string;
  receivedAmount?: string;
  swapUsdValue?: string;
}

export class WalletService {
  private connection: Connection | null = null;
  private keypair: Keypair | null = null;

  constructor(private runtime: IAgentRuntime) {}

  async initialize(): Promise<void> {
    try {
      // Initialize Solana connection
      const rpcUrl = this.runtime.getSetting("SOLANA_RPC_URL");
      if (!rpcUrl) {
        throw new Error("Solana RPC URL not configured");
      }
      this.connection = new Connection(rpcUrl);

      // Initialize wallet
      const privateKey = this.runtime.getSetting("SOLANA_PRIVATE_KEY");
      if (!privateKey) {
        throw new Error("Solana private key not configured");
      }

      const decodedKey = bs58.decode(privateKey);
      this.keypair = Keypair.fromSecretKey(decodedKey);

      logger.info("Wallet service initialized successfully");
    } catch (error) {
      console.log("Failed to initialize wallet service:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.connection = null;
    this.keypair = null;
  }

  async getWallet() {
    if (!this.keypair || !this.connection) {
      throw new Error("Wallet not initialized");
    }

    return {
      publicKey: this.keypair.publicKey,
      connection: this.connection,

      async buy({ tokenAddress, amountInSol, slippageBps }): Promise<WalletOperationResult> {
        try {
          // Execute buy using Jupiter or other DEX
          const result = await this.executeTrade({
            tokenAddress,
            amount: amountInSol,
            slippage: slippageBps / 10000,
            action: "BUY",
          });

          return result;
        } catch (error) {
          logger.error("Error executing buy in wallet", error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      },

      async sell({ tokenAddress, tokenAmount, slippageBps }): Promise<WalletOperationResult> {
        try {
          // Execute sell using Jupiter or other DEX
          const result = await this.executeTrade({
            tokenAddress,
            amount: tokenAmount,
            slippage: slippageBps / 10000,
            action: "SELL",
          });

          return result;
        } catch (error) {
          console.log("Error executing sell in wallet", error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      }
    };
  }

  async getBalance(): Promise<number> {
    if (!this.keypair || !this.connection) {
      throw new Error("Wallet not initialized");
    }

    try {
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.log("Error getting wallet balance:", error);
      throw error;
    }
  }

  private async executeTrade({
    tokenAddress,
    amount,
    slippage,
    action
  }: {
    tokenAddress: string;
    amount: number;
    slippage: number;
    action: "BUY" | "SELL";
  }): Promise<WalletOperationResult> {
    // Implementation of Jupiter DEX integration would go here
    // This is a placeholder that would need to be replaced with actual DEX integration
    logger.info(`Executing ${action} trade`, {
      tokenAddress,
      amount,
      slippage
    });

    throw new Error("Trade execution not implemented");
  }
} 