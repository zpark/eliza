import { BigNumber } from "@ethersproject/bignumber";
import { MarketType } from "../type";


export interface CallDetails {
    target: string;
    data: string;
    value?: BigNumber;
  }

  export interface TokenBalances {
    [tokenAddress: string]: BigNumber
  }

  export interface MultipleCallData {
    targets: Array<string>
    data: Array<string>
  }


export abstract class EthMarket implements MarketType {
    constructor(
        public marketAddress: string,
        public tokenAddress: string,
        public tokens: string[],
        public protocol: any
    ) {}

    async getReserves(tokenAddress: string): Promise<BigNumber> {
        // Implementation
        return BigNumber.from(0);
    }

    async getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): Promise<BigNumber> {
        // Implementation
        return BigNumber.from(0);
    }

    async getPriceImpact(tokenAddress: string, tradeSize: BigNumber): Promise<BigNumber> {
        // Implementation
        return BigNumber.from(0);
    }

    async getTradingFee(tokenAddress: string): Promise<BigNumber> {
        // Implementation
        return BigNumber.from(0);
    }

    async getBalance(tokenAddress: string): Promise<BigNumber> {
        // Implementation
        return BigNumber.from(0);
    }

    async sellTokens(tokenAddress: string, volume: BigNumber, recipient: string): Promise<string> {
        // Implementation
        return "";
    }

    async sellTokensToNextMarket(tokenAddress: string, volume: BigNumber, nextMarket: MarketType): Promise<BuyCalls> {
        // Implementation
        return { targets: [], data: [] };
    }

    abstract receiveDirectly(tokenAddress: string): boolean;
}

export interface BuyCalls {
    targets: string[];
    data: string[];
}