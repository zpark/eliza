import { composeContext, Content, elizaLogger, IAgentRuntime, Memory, ModelClass, parseJSONObjectFromText } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import { TrustScoreDatabase } from "../../community-trader/db";
import { BuySignalMessage } from "../types";
import { tradeAnalysisTemplate } from "../utils/analyzeTrade";
import { executeTrade, getWalletBalance } from "../utils/wallet";
import { DataLayer } from './dataLayer';

async function analyzeTradingAmount({
  walletBalance,
  tokenAddress,
  runtime,
  defaultPercentage = 0.1
}: {
  walletBalance: number;
  tokenAddress: string;
  runtime: IAgentRuntime;
  defaultPercentage?: number;
}): Promise<number> {
  try {
    // Log input parameters
    elizaLogger.info('Starting trade analysis with:', {
      walletBalance,
      tokenAddress,
      defaultPercentage
    });

    // Fetch token recommendation
    const tokenRecommendation = await DataLayer.getTokenRecommendation();

    const context = composeContext({
      template: tradeAnalysisTemplate,
      state: {
        bio: "",
        lore: "",
        messageDirections: "",
        postDirections: "",
        replyDirections: "",
        systemDirections: "",
        userDirections: "",
        roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`,
        actors: JSON.stringify(["trader"]),
        recentMessages: JSON.stringify([""]),
        recentMessagesData: [],
        walletBalance: walletBalance.toString(),
        api_data: JSON.stringify({  // Format the API data nicely
          recommended_buy: tokenRecommendation.recommended_buy,
          recommend_buy_address: tokenRecommendation.recommend_buy_address,
          reason: tokenRecommendation.reason,
          buy_amount: tokenRecommendation.buy_amount,
          marketcap: tokenRecommendation.marketcap
        }, null, 2)  // Pretty print with 2 spaces indentation
      }
    });

    // Remove or update the analysisData object since we're not using it anymore
    elizaLogger.info('Analysis data being sent:', { tokenRecommendation });

    // Log context
    elizaLogger.info('Generated context:', { context });

    // Log context with interpolated template
    elizaLogger.info('Final interpolated template:', {
      interpolated: context.replace('{{walletBalance}}', walletBalance.toString())
    });

    // Generate analysis
    const content = await runtime.useModel(ModelClass.LARGE, {
      context,
    });

    // Log generated content
    elizaLogger.info('Generated analysis content:', { content });

    if (!content) {
      elizaLogger.warn('No analysis generated, using default percentage');
      return walletBalance * defaultPercentage;
    }

    // Log parsed recommendation
    const recommendation = parseJSONObjectFromText(content);
    elizaLogger.info('Parsed recommendation:', { recommendation });

    const suggestedAmount = recommendation.suggestedAmount || walletBalance * defaultPercentage;
    elizaLogger.info('Final suggested amount:', { suggestedAmount });

    return Math.min(suggestedAmount, walletBalance);
  } catch (error) {
    elizaLogger.error('Trade analysis failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return walletBalance * defaultPercentage;
  }
}

export async function handleBuySignal(
  signal: BuySignalMessage,
  runtime: IAgentRuntime
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  outAmount?: string;
  swapUsdValue?: string;
  recommenderId?: string;
}> {
  elizaLogger.info('Buy signal received by worker:', signal);

  const TRADER_KUMA = runtime.getSetting('TRADER_KUMA')
  if (TRADER_KUMA) {
    fetch(TRADER_KUMA).catch((e) => {
      console.error("TRADER_KUMA err", e);
    });
  }

  try {
    // Get current wallet balance
    const walletBalance = await getWalletBalance(runtime);
    elizaLogger.info('Current wallet balance:', { walletBalance });

    // Analyze and determine trade amount based on wallet balance
    const tradeAmount = await analyzeTradingAmount({
      walletBalance,
      tokenAddress: signal.tokenAddress,
      runtime,
      defaultPercentage: 0.1
    });

    // Add retry logic for quote
    let quoteData;
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        elizaLogger.info('Attempting to get quote (attempt ' + (i + 1) + '):', {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: signal.tokenAddress,
          amount: tradeAmount * 1e9,
          slippageBps: 4500
        });

        const quoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${signal.tokenAddress}&amount=${Math.round(tradeAmount * 1e9)}&slippageBps=4500`
        );

        if (!quoteResponse.ok) {
          const errorText = await quoteResponse.text();
          elizaLogger.error('Quote API error response:', {
            status: quoteResponse.status,
            statusText: quoteResponse.statusText,
          });
          throw new Error(`Quote API returned ${quoteResponse.status}: ${errorText}`);
        }

        quoteData = await quoteResponse.json();
        elizaLogger.info('Raw quote response:', quoteData);

        if (!quoteData.outAmount || !quoteData.routePlan) {
          throw new Error(`Invalid quote response: ${JSON.stringify(quoteData)}`);
        }

        elizaLogger.info('Quote received successfully:', quoteData);
        break;
      } catch (error) {
        elizaLogger.error(`Quote attempt ${i + 1} failed:`, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        if (i === maxRetries - 1) {
          throw new Error(`Failed to get quote after ${maxRetries} attempts: ${error.message}`);
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }

    // Execute the trade
    const tradeResult = await executeTrade(runtime, {
      tokenAddress: signal.tokenAddress,
      amount: tradeAmount,
      slippage: 0.45,
      dex: 'jupiter',
      action: 'BUY'
    });

    if (tradeResult.success) {
      elizaLogger.info('Trade executed successfully:', {
        signature: tradeResult.signature,
        tokenAddress: signal.tokenAddress,
        amount: tradeAmount
      });

      // Create trade memory object
      const tradeMemory: Memory = {
        userId: `${signal.positionId}-0000-0000-0000-000000000000`, // Convert to UUID format
        agentId: runtime.agentId,
        roomId: `${signal.positionId}-0000-0000-0000-000000000000`, // Convert to UUID format
        content: {
          text: `Execute trade for ${signal.tokenAddress}`,
          tokenAddress: signal.tokenAddress,
          amount: tradeAmount,
          action: "BUY",
          source: "system",
          type: "trade",
        },
      };

      // Create trade context object
      const tradeContent = {
        text: `Execute trade for ${signal.tokenAddress}`,
        tokenAddress: signal.tokenAddress,
        tradeAmount,
        memory: [tradeMemory], // Use memory instead of tradeMemory
        type: "trade_execution",
        timestamp: new Date().toISOString(),
        trade: {
          action: "BUY",
          tokenAddress: signal.tokenAddress,
          amount: tradeAmount,
          signature: tradeResult.signature,
          chain: "solana"
        }
      } as Content;

      // Store trade information in state
      await runtime.composeState({
        userId: `${signal.positionId}-0000-0000-0000-000000000000`,
        agentId: runtime.agentId,
        roomId: `trade-0000-0000-0000-${Date.now().toString(16)}`,
        content: tradeContent
      });

      // Add Trustdb
      const trustScoreDb = new TrustScoreDatabase(runtime.databaseAdapter.db);
      const uuid = uuidv4();
      const recommender = await trustScoreDb.getOrCreateRecommender({
        id: uuid,
        solanaPubkey: runtime.getSetting("SOLANA_PUBLIC_KEY") || "",
        address: ""
      });

      const tradePerformance = await trustScoreDb.addTradePerformance({
        token_address: signal.tokenAddress,
        recommender_id: recommender.id,
        buy_price: Number(quoteData.swapUsdValue) / (Number(quoteData.outAmount) / 1e9),
        buy_timeStamp: new Date().toISOString(),
        buy_amount: Number(quoteData.outAmount) / 1e9,
        buy_value_usd: Number(quoteData.swapUsdValue),
        buy_market_cap: Number(quoteData.marketCap) || 0,
        buy_liquidity: Number(quoteData.liquidity?.usd) || 0,
        buy_sol: tradeAmount,
        last_updated: new Date().toISOString(),
        sell_price: 0,
        sell_timeStamp: "",
        sell_amount: 0,
        received_sol: 0,
        sell_value_usd: 0,
        sell_market_cap: 0,
        sell_liquidity: 0,
        profit_usd: 0,
        profit_percent: 0,
        market_cap_change: 0,
        liquidity_change: 0,
        rapidDump: false
      }, false);

      elizaLogger.info('Trustdb added successfully:', {
        uuid,
        recommender,
        tradePerformance
      });

      elizaLogger.info('Buy execution completed successfully:', {
        signal,
        signature: tradeResult.signature,
        amount: tradeAmount
      });
      return {
        ...tradeResult,
        recommenderId: recommender.id,
        outAmount: quoteData.outAmount,
        swapUsdValue: quoteData.swapUsdValue
      };
    } else {
      elizaLogger.warn('Buy execution failed or was rejected:', {
        signal,
        error: tradeResult.error
      });
      return {success: false};
    }
  } catch (error) {
    elizaLogger.error('Failed to process buy signal:', error);
    return {success: false};
  }
}