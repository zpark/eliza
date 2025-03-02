import { elizaLogger, IAgentRuntime, Memory, Content } from "@elizaos/core";
import { SellSignalMessage } from "../types";
import { SonarClient } from "../services/sonarClient";
import { executeTrade, getWalletKeypair } from "../utils/wallet";
import {Connection} from "@solana/web3.js";
import { TrustScoreDatabase } from "@elizaos/plugin-trustdb";
import { VersionedTransaction } from "@solana/web3.js";

// Add balance tracking
let pendingSells: { [tokenAddress: string]: bigint } = {};

export async function handleSellSignal(
  signal: SellSignalMessage,
  runtime: IAgentRuntime,
  sonarClient: SonarClient
): Promise<{success: boolean; signature?: string; error?: string}> {

  const TRADER_SELL_KUMA = runtime.getSetting("TRADER_SELL_KUMA");
  if (TRADER_SELL_KUMA) {
    fetch(TRADER_SELL_KUMA).catch((e) => {
      console.error("TRADER_SELL_KUMA err", e);
    });
  }

  const tokenAddress = signal.tokenAddress;

  try {
    const sellAmount = BigInt(signal.amount);

    try {
      // Get quote from Sonar API instead of Jupiter
      const quoteResponse = await sonarClient.getQuote({
        inputMint: tokenAddress,
        outputMint: 'So11111111111111111111111111111111111111112',
        amount: sellAmount.toString(),
        walletAddress: signal.walletAddress,
        slippageBps: 4500
      });

      // Log the quote details for debugging
      elizaLogger.info('Quote details:', {
        inputAmount: signal.amount,
        currentBalance: signal.currentBalance,
        quoteAmount: quoteResponse.quoteData.inAmount,
        outAmount: quoteResponse.quoteData.outAmount,
        swapMode: quoteResponse.quoteData.swapMode
      });

      // Execute the sell trade using the transaction from Sonar
      const transactionBuf = Buffer.from(quoteResponse.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      const keypair = getWalletKeypair(runtime);
      transaction.sign([keypair]);

      // Execute the signed transaction
      const connection = new Connection("https://zondra-wil7oz-fast-mainnet.helius-rpc.com");
      const signature = await connection.sendTransaction(transaction);

      if (signature) {
        elizaLogger.info('Sell trade executed successfully:', {
          signature,
          tokenAddress,
          amount: signal.amount
        });

        // Get latest blockhash for confirmation
        const connection = new Connection("https://zondra-wil7oz-fast-mainnet.helius-rpc.com");
        const latestBlockhash = await connection.getLatestBlockhash();

        try {
          const confirmation = await connection.confirmTransaction(
            {
              signature: signature,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              blockhash: latestBlockhash.blockhash,
            },
            "finalized"
          );

          if (confirmation.value.err) {
            elizaLogger.error('Transaction confirmation failed:', {
              error: confirmation.value.err,
              signature: signature
            });
            return { success: false, error: 'Transaction confirmation failed' };
          }

          try {
            // Update TrustDB with sell information
            const trustScoreDb = new TrustScoreDatabase(runtime.databaseAdapter.db);
            const latestTrade = await trustScoreDb.getLatestTradePerformance(
              tokenAddress,
              signal.sellRecommenderId,
              false
            );

            if (latestTrade) {
              const currentPrice = Number(quoteResponse.quoteData.swapUsdValue) / Number(signal.amount);
              const sellAmount = Number(signal.amount);
              const sellValueUsd = Number(quoteResponse.quoteData.swapUsdValue);
              const marketCap = 0; // Could be fetched from Birdeye if needed
              const liquidity = 0; // Could be fetched from Birdeye if needed

              await trustScoreDb.updateTradePerformanceOnSell(
                tokenAddress,
                signal.sellRecommenderId,
                latestTrade.buy_timeStamp,
                {
                  sell_price: currentPrice,
                  sell_timeStamp: new Date().toISOString(),
                  sell_amount: sellAmount,
                  received_sol: Number(quoteResponse.quoteData.outAmount) / 1e9,
                  sell_value_usd: sellValueUsd,
                  sell_market_cap: marketCap,
                  market_cap_change: marketCap - latestTrade.buy_market_cap,
                  sell_liquidity: liquidity,
                  liquidity_change: liquidity - latestTrade.buy_liquidity,
                  profit_usd: sellValueUsd - latestTrade.buy_value_usd,
                  profit_percent: (sellValueUsd - latestTrade.buy_value_usd) / latestTrade.buy_value_usd * 100,
                  rapidDump: false,
                  sell_recommender_id: signal.sellRecommenderId
                },
                false
              );
            }

            await sonarClient.addDegenTransaction({
              id: signal.positionId,
              address: tokenAddress,
              amount: signal.amount,
              walletAddress: signal.walletAddress,
              isSimulation: signal.isSimulation,
              marketCap: 0,
              recommenderId: signal.sellRecommenderId,
              txHash: signature
            });

            return { success: true, signature: signature };
          } catch (error) {
            elizaLogger.error('Error in post-trade processing:', {
              error: error instanceof Error ? error.message : error,
              signature: signature
            });
            // Still return success since the trade itself worked
            return { success: true, signature: signature };
          }
        } catch (error) {
          elizaLogger.error('Error confirming transaction:', {
            error: error instanceof Error ? error.message : error,
            signature: signature
          });
          return { success: false, error: 'Transaction confirmation error' };
        }
      } else {
        elizaLogger.warn('Sell execution failed:', {
          signal,
          error: 'Transaction signature is undefined'
        });
        return { success: false, error: 'Transaction signature is undefined' };
      }
    } finally {
      // Remove from pending sells whether successful or not
      pendingSells[tokenAddress] = (pendingSells[tokenAddress] || BigInt(0)) - sellAmount;
      if (pendingSells[tokenAddress] <= BigInt(0)) {
        delete pendingSells[tokenAddress];
      }
    }
  } catch (error) {
    elizaLogger.error('Failed to process sell signal:', error);
    return {success: false};
  }
}