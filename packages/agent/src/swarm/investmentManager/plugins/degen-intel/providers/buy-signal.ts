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

Only return the following JSON:

{
recommended_buy: "the symbol of the token for example DEGENAI",
recommend_buy_address: "the address of the token to purchase, for example: 2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
reason: "the reason why you think this is a good buy, and why you chose the specific amount",
buy_amount: "number, for example: 0.1"
}`;

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
    console.log('trendingData', trendingData)
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
    console.log('context', finalPrompt)

    const response = await this.runtime.useModel(ModelTypes.TEXT_LARGE, {
      context: finalPrompt,
      system: rolePrompt,
      temperature: 0.2,
      maxTokens: 4096,
      object: true
    });

    console.log('response', response)

    // Parse the JSON response
    const json: IBuySignalOutput = parseJSONObjectFromText(response)
    //const json = JSON.parse(response || "{}") as IBuySignalOutput;
    //console.log('buysignal', json)

    if (!json.recommend_buy_address) {
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

    const res = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${json.recommend_buy_address}`, options);
    if (!res.ok) throw new Error("Birdeye marketcap request failed");

    const resJson = await res.json();
    const marketcap = resJson?.data?.realMc;

    const data = {
      ...json,
      marketcap: Number(marketcap),
    };

    this.runtime.emitEvent("SPARTAN_TRADE_BUY_SIGNAL", data)

    await this.runtime.databaseAdapter.setCache<any>("buy_signals", {
      key: "BUY_SIGNAL",
      data
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