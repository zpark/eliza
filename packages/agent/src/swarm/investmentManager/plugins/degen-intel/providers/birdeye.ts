import { type IAgentRuntime, logger } from "@elizaos/core";
import type { IToken } from "../types";

const DEGEN_WALLET = "BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq";

export default class Birdeye {
	apiKey: string;

	constructor(runtime: IAgentRuntime) {
		const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
		if (!apiKey) {
			throw new Error("Failed to initialize Birdeye provider due to missing API key.");
		}
		this.apiKey = apiKey;
	}

	private async syncWalletHistory() {
		/** Get entire transaction history */
		const options = {
			method: "GET",
			headers: { accept: "application/json", "x-chain": "solana", "X-API-KEY": this.apiKey },
		};

		const res = await fetch(`https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${DEGEN_WALLET}&limit=100`, options);

		const resp = await res.json();
		const data = resp?.data?.solana;

		const ops = [];

		for (const tx of data) {
			ops.push({
				updateOne: {
					filter: {
						txHash: tx.txHash,
					},
					update: {
						$set: {
							txHash: tx.txHash,
							blockTime: new Date(tx.blockTime),
							data: tx,
						},
					},
					upsert: true,
				},
			});
		}

		const writeResult = await DB.TransactionHistory.bulkWrite(ops);

		logger.info(writeResult, "Birdeye Transaction History resulted in:");
	}
	private async syncWalletPortfolio() {
		/** Get entire portfolio */
		const options = {
			method: "GET",
			headers: { accept: "application/json", "x-chain": "solana", "X-API-KEY": this.apiKey },
		};

		const res = await fetch(`https://public-api.birdeye.so/v1/wallet/token_list?wallet=${DEGEN_WALLET}`, options);

		const resp = await res.json();
		const data = resp?.data;

		const key = "PORTFOLIO";

		await DB.Data.updateOne({ key: "PORTFOLIO" }, { $set: { data, key } }, { upsert: true });
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

		const ops = [];

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
				const data: IToken = {
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

				ops.push({
					updateOne: {
						filter: {
							provider: "birdeye",
							rank: token.rank,
							chain,
						},
						update: {
							$set: data,
						},
						upsert: true,
					},
				});
			}

			/** Add extra delay */
			await new Promise((resolve) => setTimeout(resolve, 250));
		}

		const writeResult = await DB.Token.bulkWrite(ops);

		logger.info(writeResult, `Birdeye sync [chain: ${chain}] resulted in:`);

		return true;
	}
}
