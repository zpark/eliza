import { parseJSONObjectFromText, type IAgentRuntime, logger, ModelTypes } from "@elizaos/core";
import type { Sentiment } from "../schemas";
import type { IToken } from "../types";

const rolePrompt = "You are a buy signal analyzer.";
const template = `
I want you to give a crypto buy signal based on both the sentiment analysis as well as the trending tokens.
Only choose a token that occurs in both the Trending Tokens list as well as the Sentiment analysis. This ensures we have the proper token address.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
My current balance is {{solana_balance}} SOL, also let me know what a good amount would be to buy. Buy amount should at least be 0.05 SOL and maximum 0.25 SOL.

Sentiment analysis:

{{sentiment}}

Trending tokens:

{{trending_tokens}}

Return a valid JSON object with the following format:
{"recommended_buy":"token_symbol","recommend_buy_address":"token_address","reason":"reason_text","buy_amount":"amount"}

For example:
{"recommended_buy":"DEGENAI","recommend_buy_address":"2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump","reason":"Strong momentum and positive sentiment","buy_amount":"0.1"}`;

interface IBuySignalOutput {
  recommended_buy: string;
  recommend_buy_address: string;
  marketcap: number;
  reason: string;
  buy_amount: string;
}

export default class BuySignal {
  apiKey: string;
  runtime: IAgentRuntime;
  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async generateSignal(): Promise<boolean> {
    logger.info("buy-signal::generateSignal - Updating latest buy signal");
    // Get all sentiments (TwitterParser fillTimeframe)
    const sentimentsData = await this.runtime.databaseAdapter.getCache<Sentiment[]>("sentiments") || [];
    console.log('sentimentsData', sentimentsData)
    let sentiments = "";

    let idx = 1;
    for (const sentiment of sentimentsData) {
      if (!sentiment?.occuringTokens?.length) continue;
      sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
      for (const token of sentiment.occuringTokens) {
        sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
      }

      sentiments += "\n-------------------\n";
      idx++;
    }
    const prompt = template.replace("{{sentiment}}", sentiments);

    // Get all trending tokens

    // FIXME: nothing sets this
    const trendingData = await this.runtime.databaseAdapter.getCache<IToken[]>("tokens_solana") || [];
    //console.log('trendingData', trendingData)
    let tokens = "";
    let index = 1;
    for (const token of trendingData) {
      tokens += `ENTRY ${index}\n\nTOKEN SYMBOL: ${token.name}\nTOKEN ADDRESS: ${token.address}\nPRICE: ${token.price}\n24H CHANGE: ${token.price24hChangePercent}\nLIQUIDITY: ${token.liquidity}`;
      tokens += "\n-------------------\n";
      index++;
    }

    const solanaBalance = await this.getBalance();

    const finalPrompt = prompt.replace("{{trending_tokens}}", tokens).replace("{{solana_balance}}", String(solanaBalance));

    //console.log('rolePrompt', rolePrompt)
    //console.log('context', finalPrompt)

    let responseContent: IBuySignalOutput | null = null;
    // Retry if missing required fields
    let retries = 0;
    const maxRetries = 3;
    // recommended_buy, recommend_buy_address, reason, buy_amount
    while (retries < maxRetries && (!responseContent?.recommended_buy || !responseContent?.reason || !responseContent?.recommend_buy_address)) {
      // could use OBJECT_LARGE but this expects a string return type rn
      // not sure where OBJECT_LARGE does it's parsing...
      const response = await this.runtime.useModel(ModelTypes.TEXT_LARGE, {
        context: finalPrompt,
        system: rolePrompt,
        temperature: 0.2,
        maxTokens: 4096,
        object: true
      });

      console.log('intel:buy-signal - response', response);
      responseContent = parseJSONObjectFromText(response) as Content;

      retries++;
      if (!responseContent?.recommended_buy && !responseContent?.reason && !responseContent?.recommend_buy_address) {
        logger.warn('*** Missing required fields, retrying... generateSignal ***');
      }
    }

    if (!responseContent?.recommend_buy_address) {
      console.warn('buy-signal::generateSignal - no buy recommendation')
      return false;
    }

    // Fetch the recommended buys current marketcap
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": this.runtime.getSetting("BIRDEYE_API_KEY"),
      },
    };

    const res = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${responseContent.recommend_buy_address}`, options);
    if (!res.ok) throw new Error("Birdeye marketcap request failed");

    const resJson = await res.json();
    const marketcap = resJson?.data?.realMc;

    responseContent.marketcap = Number(marketcap)

    this.runtime.emitEvent("SPARTAN_TRADE_BUY_SIGNAL", responseContent)

    await this.runtime.databaseAdapter.setCache<any>("buy_signals", {
      key: "BUY_SIGNAL",
      data: responseContent
    });

    return true;
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