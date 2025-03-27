import { parseJSONObjectFromText, type IAgentRuntime, logger, ModelTypes } from "@elizaos/core";
import type { Sentiment } from "../schemas";
import type { IToken } from "../types";

import { SOLANA_WALLET_DATA_CACHE_KEY, type WalletPortfolio } from '@elizaos/plugin-solana';
import { ServiceTypes } from "../../degen-trader/types";

const rolePrompt = "You are a sell signal analyzer.";
const template = `

I want you to give a crypto sell signal based on both the sentiment analysis as well as the wallet token data.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
My current balance is {{solana_balance}} SOL, If I have less than 0.3 SOL, I should up the priority on selling something but we don't need to realize a heavy loss over it.

Sentiment analysis:

{{sentiment}}

Wallet tokens:

{{walletData}}

Additional wallet token data (in JSON format):
{{walletData2}}

Only return the following JSON:

{
  recommended_sell: "the symbol of the token for example DEGENAI",
  recommend_sell_address: "the address of the token to purchase, for example: 2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
  reason: "the reason why you think this is a good sell, and why you chose the specific amount",
  sell_amount: "number, for example: 0.1"
}`;

interface ISellSignalOutput {
  recommended_sell: string;
  recommend_sell_address: string;
  marketcap?: number;
  reason: string;
  sell_amount: string;
}

export default class SellSignal {
  apiKey: string;
  runtime: IAgentRuntime;
  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async generateSignal(): Promise<boolean> {
    try {
      logger.info("sell-signal::generateSignal - Updating latest sell signal");

      // transaction_history, PORTFOLIO might be interesting
      // CMC has a listing latest tokens

      const portfolioData = await this.runtime.databaseAdapter.getCache<WalletPortfolio>("PORTFOLIO") || [];
      const txHistoryData = await this.runtime.databaseAdapter.getCache<WalletPortfolio>("transaction_history") || [];

      console.log('portfolioData', portfolioData)
      /* [] */
      //console.log('txHistoryData', txHistoryData)
      /*
      {
        data: {
          to: '11111111111111111111111111111111',
          fee: 5825,
          from: '5Hr7wZg7oBpVhH5nngRqzr5W7ZFUfCsfEhbziZJak7fr',
          status: true,
          txHash: '4MEZGiFCVuwKDxcHUYXysCqFzdbnBhMQtUTKC2X9SBiDFUyuwAL8bDxr7TdJTwMKNuq38kMB3aCQ5d7jwSMBuN3a',
          blockTime: '2025-02-27T12:14:43+00:00',
          mainAction: 'received',
          blockNumber: 323431520,
          balanceChange: [Array],
          contractLabel: [Object]
        },
        txHash: '4MEZGiFCVuwKDxcHUYXysCqFzdbnBhMQtUTKC2X9SBiDFUyuwAL8bDxr7TdJTwMKNuq38kMB3aCQ5d7jwSMBuN3a',
        blockTime: '2025-02-27T12:14:43.000Z'
      },
      */

      const walletData = await this.runtime.databaseAdapter.getCache<WalletPortfolio>("solana/walletData") || [];
      //console.log('walletData', walletData)
      /*
      {
        icon: 'https://static.jup.ag/jup/icon.png',
        name: 'Jupiter',
        symbol: 'JUP',
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        balance: 98703601,
        chainId: 'solana',
        logoURI: 'https://static.jup.ag/jup/icon.png',
        decimals: 6,
        priceUsd: 0.5568798035004853,
        uiAmount: 98.703601,
        valueSol: '0.385338',
        valueUsd: 54.966041929670304
      },
      */
      // collect CA
      let walletProviderStr = 'Your wallet contents: '
      const tokensHeld = []
      for(const t of walletData.items) {
        walletProviderStr += 'You hold ' + t.uiAmount + '(' + t.balance + ') of ' + t.name + ' (' + t.symbol + ' CA: ' + t.address + ') worth $' + t.valueUsd + 'usd (' + t.valueSol + ' sol)' + "\n"
        tokensHeld.push(t.address) // CAs
      }
      let prompt = template.replace("{{walletData}}", walletProviderStr);

      // walletData already gathered all this info
      /*
      // get birdeye data for tokens
      const publicKey = this.runtime.getSetting("SOLANA_PUBLIC_KEY");
      const res = await fetch(`https://public-api.birdeye.so/v1/wallet/token_list?wallet=${publicKey}`, options);
      const resp = await res.json();
      const data = resp?.data;
      console.log('birdeye wallet data', resp)
      // address, balance, uiAMount, name, symbol, logoURI, priceUsd, valueUsd
      */

      // might be best to move this out of this function
      const tradeService = this.runtime.getService(ServiceTypes.DEGEN_TRADING)
      const tokenData = await tradeService.dataService.getTokensMarketData(tokensHeld);
      prompt = prompt.replace("{{walletData2}}", JSON.stringify(tokenData));

      // here's your wallet should we sell anything
      // FIXME: update prompt

      // Get all sentiments (TwitterParser fillTimeframe)
      const sentimentData = await this.runtime.databaseAdapter.getCache<Sentiment[]>("sentiments") || [];
      //console.log('sentimentsData', sentimentData)
      let sentiments = "";

      let idx = 1;
      for (const sentiment of sentimentData) {
        if (!sentiment?.occuringTokens?.length) continue;
        sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
        for (const token of sentiment.occuringTokens) {
          sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
        }

        sentiments += "\n-------------------\n";
        idx++;
      }
      prompt = prompt.replace("{{sentiment}}", sentiments);

      // Get all trending tokens
      /*
      // FIXME: nothing sets this
      const trendingData = await this.runtime.databaseAdapter.getCache<IToken[]>("tokens_solana") || [];
      console.log('trendingData', trendingData)
      let tokens = "";
      let index = 1;
      for (const token of trendingData) {
        tokens += `ENTRY ${index}\n\nTOKEN SYMBOL: ${token.name}\nTOKEN ADDRESS: ${token.address}\nPRICE: ${token.price}\n24H CHANGE: ${token.price24hChangePercent}\nLIQUIDITY: ${token.liquidity}`;
        tokens += "\n-------------------\n";
        index++;
      }
      */

      const solanaBalance = await this.getBalance();

      // prompt.replace("{{trending_tokens}}", tokens).
      const finalPrompt = prompt.replace("{{solana_balance}}", String(solanaBalance));

      //console.log('sell rolePrompt', rolePrompt)
      console.log('sell context', finalPrompt)

      let responseContent: ISellSignalOutput | null = null;
      // Retry if missing required fields
      let retries = 0;
      const maxRetries = 3;
      // recommended_sell, recommend_sell_address, reason, sell_amount
      while (retries < maxRetries && (!responseContent?.recommended_sell || !responseContent?.reason || !responseContent?.recommend_sell_address)) {
        // could use OBJECT_LARGE but this expects a string return type rn
        // not sure where OBJECT_LARGE does it's parsing...
        const response = await this.runtime.useModel(ModelTypes.TEXT_LARGE, {
          context: finalPrompt,
          system: rolePrompt,
          temperature: 0.2,
          maxTokens: 4096,
          object: true
        });

        //console.log('intel:sell-signal - response', response);
        responseContent = parseJSONObjectFromText(response) as Content;

        retries++;
        if (!responseContent?.recommended_sell && !responseContent?.reason && !responseContent?.recommend_sell_address) {
          logger.warn('*** Missing required fields, retrying... shouldRespondPrompt ***');
        }
      }

      //console.log('sell-signal::generateSignal - have response')

      if (!responseContent?.recommend_sell_address) {
        console.warn('sell-signal::generateSignal - no sell recommendation')
        return false;
      }

      //console.log('sell-signal::generateSignal - birdeye time')

      // Fetch the recommended sells current marketcap
      const options = {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-chain": "solana",
          "X-API-KEY": this.runtime.getSetting("BIRDEYE_API_KEY"),
        },
      };

      const res = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${responseContent.recommend_sell_address}`, options);
      if (!res.ok) throw new Error("Birdeye marketcap request failed");

      const resJson = await res.json();
      //console.log('sell-signal birdeye check', resJson)

      // lots of good info

      const marketcap = resJson?.data?.realMc;

      responseContent.marketcap = Number(marketcap);

      console.log('sell-signal::generateSignal - sending signal')

      /*
      const signal: SellSignalMessage = {
        positionId: uuidv4() as UUID,
        tokenAddress: params.recommend_sell_address,
        // pairId
        amount: params.sell_amount,
        // currentBalance
        // sellRecommenderId
        // walletAddress
        // isSimulation
        // reason
        entityId: "default",
      };
      */

      this.runtime.emitEvent("SPARTAN_TRADE_SELL_SIGNAL", responseContent)

      await this.runtime.databaseAdapter.setCache<any>("sell_signals", {
        key: "SELL_SIGNAL",
        data: responseContent
      });

      return true;
    } catch(e) {
      console.error('sell-signal::generateSignal - err', e)
    }
  }

  async getBalance() {
    // this.runtime.getSetting("BIRDEYE_API_KEY")
    const url = "https://zondra-wil7oz-fast-mainnet.helius-rpc.com";
    const headers = {
      "Content-Type": "application/json",
    };

    const data = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [this.runtime.getSetting("SOLANA_PUBLIC_KEY")],
    };
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();

    const lamportsBalance = result?.result?.value;

    return lamportsBalance / 1000000000;
  }
}