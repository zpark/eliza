import { type IAgentRuntime, logger, ModelClass } from "@elizaos/core";
import SentimentModel from "../models/sentiment";
import TokenModel from "../models/token";
import DataModel from "../models/data";

const DB = {
	Sentiment: SentimentModel,
	Token: TokenModel,
	Data: DataModel
};

const DEGEN_WALLET = "BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq";
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
		logger.info("Updating latest buy signal");
		/** Get all sentiments */
		const sentimentsData = await DB.Sentiment.find().sort("-timeslot").limit(5).lean();
		let sentiments = "";

		let idx = 1;
		for (const sentiment of sentimentsData) {
			if (sentiment?.occuringTokens?.length <= 0) continue;
			sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
			for (const token of sentiment.occuringTokens) {
				sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
			}

			sentiments += "\n-------------------\n";
			idx++;
		}
		const prompt = template.replace("{{sentiment}}", sentiments);

		/** Get all trending tokens */
		const trendingData = await DB.Token.find({ provider: "birdeye", chain: "solana" }).limit(100).sort("rank").lean();
		let tokens = "";
		let index = 1;
		for (const token of trendingData) {
			tokens += `ENTRY ${index}\n\nTOKEN SYMBOL: ${token.name}\nTOKEN ADDRESS: ${token.address}\nPRICE: ${token.price}\n24H CHANGE: ${token.price24hChangePercent}\nLIQUIDITY: ${token.liquidity}`;
			tokens += "\n-------------------\n";
			index++;
		}

		const solanaBalance = await this.getBalance();

		const finalPrompt = prompt.replace("{{trending_tokens}}", tokens).replace("{{solana_balance}}", String(solanaBalance));

		const response = await this.runtime.useModel(ModelClass.TEXT_LARGE, {
			context: finalPrompt,
			system: rolePrompt,
			temperature: 0.2,
			maxTokens: 4096,
			object: true
		});

		// Parse the JSON response
		const json = JSON.parse(response || "{}") as IBuySignalOutput;

		/** Fetch the recommended buys current marketcap */
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

		await DB.Data.updateOne(
			{
				key: "BUY_SIGNAL",
			},
			{
				$set: {
					key: "BUY_SIGNAL",
					data,
				},
			},
			{
				upsert: true,
			},
		);

		return true;
	}

	async getBalance() {
		const url = "https://zondra-wil7oz-fast-mainnet.helius-rpc.com";
		const headers = {
			"Content-Type": "application/json",
		};

		const data = {
			jsonrpc: "2.0",
			id: 1,
			method: "getBalance",
			params: [DEGEN_WALLET],
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
