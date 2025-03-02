import { IAgentRuntime, UUID } from "@elizaos/core";
import { http } from "./clients"
import {
    BuyData,
    Position,
    Recommender,
    SellData,
    TokenRecommendation,
} from "./types";

export class TrustScoreBeClient {
    static createFromRuntime(runtime: IAgentRuntime) {
        const url = runtime.getSetting("BACKEND_URL");

        if (!url) {
            throw new Error("Missing key BACKEND_URL");
        }

        const apiKey = runtime.getSetting("BACKEND_TOKEN");

        if (!apiKey) {
            throw new Error("Missing key BACKEND_TOKEN");
        }

        return new this(url, apiKey);
    }

    constructor(
        private readonly url: string,
        private readonly apiKey: string
    ) {}

    async request(path: string, body: any) {
        try {
            console.log("backend", {
                path,
                body,
            });
            return await http.post.json(`${this.url}${path}`, body, {
                headers: {
                    "x-api-key": this.apiKey,
                },
            });
        } catch (error) {
            console.log("trust backend request failed");
            console.error(error);
            throw error;
        }
    }

    async createPosition(position: Position, data: BuyData) {
        return this.request("/updaters/createPosition", {
            id: position.id,

            chain: position.chain,
            tokenAddress: position.tokenAddress,
            isSimulation: position.isSimulation,

            recommender: data.recommender,
            recommendationId: position.recommendationId,

            initialPrice: position.initialPrice,
            initialMarketCap: position.initialMarketCap,
            initialLiquidity: position.initialLiquidity,

            solAmount: data.solAmount.toString(),
            buyAmount: data.buyAmount.toString(),

            txHash: data.txHash,
            timestamp: data.timestamp,
            wallet: data.walletAddress,
        });
    }

    async updatePosition(position: Position, data: SellData, close: boolean) {
        return this.request("/updaters/updatePosition", {
            id: position.id,

            solAmount: data.solAmount.toString(),
            sellAmount: data.sellAmount.toString(),

            txHash: data.txHash,
            timestamp: data.timestamp,

            wallet: position.walletAddress,

            close,
        });
    }

    async createRecommendation(
        recommender: Recommender,
        tokenRecommendation: TokenRecommendation
    ) {
        return this.request("/updaters/createRecommendation", {
            id: tokenRecommendation.id,
            recommender: recommender,
            chain: tokenRecommendation.chain,
            tokenAddress: tokenRecommendation.tokenAddress,
            conviction: tokenRecommendation.conviction,

            type: tokenRecommendation.type,
            timestamp: tokenRecommendation.createdAt,

            msg: tokenRecommendation.metadata.msg,
            chatId: tokenRecommendation.metadata.chatId.toString(),
        });
    }
}

type SonarProcessData = {
    id: UUID;
    tokenAddress: string;
    balance: string;
    isSimulation: boolean;
    recommenderId: string;
    initialMarketCap: string;
    walletAddress: string;
    txHash: string;
    initialPrice: string;
};

export class Sonar {
    static createFromRuntime(runtime: IAgentRuntime) {
        const url = runtime.getSetting("SONAR_URL");

        if (!url) {
            throw new Error("Missing key SONAR_URL");
        }

        const apiKey = runtime.getSetting("SONAR_TOKEN");

        if (!apiKey) {
            throw new Error("Missing key SONAR_TOKEN");
        }

        return new this(url, apiKey);
    }

    constructor(
        private readonly url: string,
        private readonly apiKey: string
    ) {}

    async request<ReturnType = any>(path: string, body: any) {
        try {
            console.log("sonar", {
                path,
                body,
            });
            return http.post.json<ReturnType>(`${this.url}${path}`, body, {
                headers: {
                    "x-api-key": this.apiKey,
                },
            });
        } catch (error) {
            console.error(`Error sending message to sonar:`, { path, body });
            throw error;
        }
    }

    async startProcess(process: SonarProcessData) {
        return this.request(`/ai16z-sol/startProcess`, process);
    }

    async stopProcess(id: UUID) {
        return this.request(`/ai16z-sol/stopProcess`, {
            id,
        });
    }

    async saveTransaction(tx: {
        id: UUID;
        address: string;
        amount: string;
        walletAddress: string;
        isSimulation: boolean;
        recommenderId: UUID;
        marketCap: number;
        txHash: string;
    }) {
        return this.request(`/ai16z-sol/addTransaction`, tx);
    }

    async quote(params: {
        chain: string;
        inputToken: string;
        outputToken: string;
        amountIn: bigint;
        walletAddress: string;
        slippageBps: number;
    }) {
        const res = await http.get.json<{
            quoteData: any;
            swapTransaction: any;
        }>(
            `${this.url}/ai16z-sol/quote`,
            {
                inputMint: params.inputToken,
                outputMint: params.outputToken,
                amount: params.amountIn.toString(),
                slippageBps: params.slippageBps,
                walletAddress: params.walletAddress,
            },
            {
                headers: {
                    "x-api-key": this.apiKey,
                },
            }
        );

        return res;
    }
}
