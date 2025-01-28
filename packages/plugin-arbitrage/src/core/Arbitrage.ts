import * as _ from "lodash";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";
import { Provider } from "@ethersproject/providers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
// import { WETH_ADDRESS } from "././addresses";
import { EthMarket } from "././EthMarket";
// import { ETHER, bigNumberToDecimal } from "./utils";
import { EthMarket as EthMarketType, CrossedMarketDetails, MarketsByToken, MarketType, BuyCalls } from "././types";
// import { TransactionResponse } from "@ethersproject/providers";
// import { DEFAULT_THRESHOLDS, MarketThresholds } from '../config/thresholds';
// import { MarketsByToken as ImportedMarketsByToken, CrossedMarketDetails as ImportedCrossedMarketDetails } from "../type";
export { MarketsByToken, EthMarket, CrossedMarketDetails } from '././types';

export interface BundleEntry {
  to: string,
  gas: number,
  gas_price: string,
  value: number,
  input: string,
  from: string,
  signedTransaction: string,
  signer: string,
}

interface ArbitrageTransaction {
  hash: string;
  wait: () => Promise<{ blockNumber: number }>;
}

const CFMM = {
  reserves: {
    x: BigNumber.from(0),
    y: BigNumber.from(0),
  },
  getOutputAmount: (inputAmount: BigNumber, inputReserve: BigNumber, outputReserve: BigNumber) => {
    const inputAmountWithFee = inputAmount.mul(997);
    const numerator = inputAmountWithFee.mul(outputReserve);
    const denominator = inputReserve.mul(1000).add(inputAmountWithFee);
    return numerator.div(denominator);
  },
  tradingFee: BigNumber.from("3000"),
};

const acceptTrade = (R: BigNumber, deltaPlus: number, deltaMinus: number) => {
  const tradingFunctionResult = CFMM.getOutputAmount(R.sub(CFMM.tradingFee.mul(deltaMinus)).sub(deltaPlus), CFMM.reserves.x, CFMM.reserves.y);
  const tradingFunctionResult2 = CFMM.getOutputAmount(R, CFMM.reserves.x, CFMM.reserves.y);
  console.log(`acceptTrade: tradingFunctionResult = ${tradingFunctionResult}, tradingFunctionResult2 = ${tradingFunctionResult2}`);
  return tradingFunctionResult.gte(tradingFunctionResult2) && R.sub(CFMM.tradingFee.mul(deltaMinus)).sub(deltaPlus).gte(0);
};


export const dualDecomposition = (referencePrices: string | any[], objectiveFunction: (arg0: any) => any, penaltyVector: number[]) => {
  console.log("Entering dualDecomposition");
  const T = [];
  for (let i = 0; i < referencePrices.length; i++) {
    let deltaPlus = referencePrices[i].cumulativePrice;
    let deltaMinus = Math.min(referencePrices[i].cumulativePrice, 0);
    console.log(`dualDecomposition: iteration ${i}, deltaPlus = ${deltaPlus}, deltaMinus = ${deltaMinus}`);
    if (acceptTrade(CFMM.reserves.x, deltaPlus, deltaMinus)) {
      T.push([deltaPlus, deltaMinus]);
    }
  }
  let nu = 0;
  for (let i = 0; i < T.length; i++) {
    let objectiveFunctionResult = objectiveFunction(T[i][0]);
    let penaltyResult = penaltyVector[i] * nu;
    console.log(`dualDecomposition: iteration ${i}, objectiveFunctionResult = ${objectiveFunctionResult}, penaltyResult = ${penaltyResult}`);
    nu = Math.max(nu, (objectiveFunctionResult - penaltyResult));
  }
  console.log(`dualDecomposition: final nu = ${nu}`);
  return nu;
};

export async function calculateOptimalVolume(
  buyFromMarket: MarketType,
  sellToMarket: MarketType,
  tokenAddress: string,
  profit: number
): Promise<BigNumber> {
  console.log("Entering calculateOptimalVolume");

  // Determine the available liquidity in both markets involved in the arbitrage
  const availableLiquidityBuy = await buyFromMarket.getReserves(tokenAddress);
  const availableLiquiditySell = await sellToMarket.getReserves(tokenAddress);

  // Set a maximum trade size limit to manage risk
  const maxTradeSize = BigNumber.from(100000); // Adjust as needed

  // Minimum profit threshold
  const minProfitThreshold = BigNumber.from(1); // Adjust as needed

  // Calculate price impacts and trading fees
  const priceImpactBuy = await buyFromMarket.getPriceImpact(tokenAddress, maxTradeSize);
  const priceImpactSell = await sellToMarket.getPriceImpact(tokenAddress, maxTradeSize);

  const tradingFeeBuy = await buyFromMarket.getTradingFee(tokenAddress);
  const tradingFeeSell = await sellToMarket.getTradingFee(tokenAddress);

  // Binary Search Initialization
  let left = BigNumber.from(1);
  let right = maxTradeSize;
  let optimalVolume = BigNumber.from(0);
  let maxExpectedProfit = BigNumber.from(0);

  while (left.lt(right)) {
    const mid = left.add(right).div(2);

    // Calculate expected profit at mid
    const expectedProfit = BigNumber.from(profit)
      .mul(mid)
      .sub(priceImpactBuy.mul(mid))
      .sub(priceImpactSell.mul(mid))
      .sub(tradingFeeBuy.mul(mid))
      .sub(tradingFeeSell.mul(mid));

    if (expectedProfit.gt(maxExpectedProfit) && expectedProfit.gte(minProfitThreshold)) {
      maxExpectedProfit = expectedProfit;
      optimalVolume = mid;
      left = mid.add(1);
    } else {
      right = mid.sub(1);
    }
  }

  // Ensure that the optimal volume does not exceed available liquidity
  optimalVolume = BigNumber.from(Math.min(
    optimalVolume.toNumber(),
    availableLiquidityBuy.toNumber(),
    availableLiquiditySell.toNumber()
  ));

  console.log(`calculateOptimalVolume: optimalVolume = ${optimalVolume}`);

  return optimalVolume;
}
// // Define the bisection search
//     // Define the bisection search
//     let bisectionSearch = (referencePrices: Array<{cumulativePrice: number, marketCount: number}>, objectiveFunction:  (arg0: number) => number, penaltyVector: number[]) => {
//       console.log("Entering bisectionSearch");
//         let left = 0;
//         let right = referencePrices.length - 1;
//         let tolerance = 1e-6;
//         let psi;

//         while (right - left > tolerance) {
//           let mid = Math.floor((left + right) / 2);
//           let midValue = objectiveFunction(mid);
//           let penaltyResult = penaltyVector[mid] * mid;

//           if (midValue > penaltyResult) {
//             left = mid;
//             psi = mid;
//           } else {
//             right = mid;
//           }
//         }
//         console.log(`bisectionSearch: final psi = ${psi}`);

//         return psi;
//       };

// let swapMarketArbitrage = (referencePrices: Array<{cumulativePrice: number, marketCount: number}> = [], objectiveFunction: (price: number) => number, penaltyVector: number[]) => {
//     // Initialize the dual variable ν
//     console.log("Entering swapMarketArbitrage");

//     let nu = 0;

//     // Use bisection or ternary search to solve for the vector Ψ
//     // Assuming that bisectionSearch accepts a number, not an array
//     let psi = bisectionSearch(referencePrices, objectiveFunction, penaltyVector);

//     // Iterate through the ∆i with i = 1, . . . , m
//     for (let i = 0; i < referencePrices.length; i++) {
//       // Compute the objective function U(Ψ)
//       // Ensure psi is used correctly as an index
//       if (psi !== undefined && psi >= 0 && psi < referencePrices.length) {
//         const objectiveFunctionResult = objectiveFunction(referencePrices[psi].cumulativePrice);

//         // Compute the linear penalty in the objective
//         let penaltyResult = penaltyVector[i] * nu;

//         // Update the dual variable ν
//         nu = Math.max(nu, (objectiveFunctionResult - penaltyResult));
//       }
//     }
//     // Return the dual variable ν
//     console.log(`swapMarketArbitrage: final nu = ${nu}`);
//     return nu;
//   };

export async function getGasPriceInfo(provider: Provider): Promise<{ currentGasPrice: BigNumber, avgGasPrice: BigNumber }> {
  console.log("Entering getGasPriceInfo");
  const latestBlock = await provider.getBlock("latest");
  if (!latestBlock) {
    throw new Error("Failed to get latest block");
  }
  const blockNumber = latestBlock.number;
  const blockGasPrices: BigNumber[] = [];

  for (let i = 0; i < 10; i++) {
    const block = await provider.getBlock(blockNumber - i);
    if (!block) {
      console.warn(`Failed to get block ${blockNumber - i}`);
      continue;
    }
    const transactions = block.transactions;
    let totalGasPriceInBlock = BigNumber.from(0);
    let transactionCountInBlock = 0;
    for (const txHash of transactions) {
        const tx = await provider.getTransaction(txHash);
        if (tx?.gasPrice) {
          totalGasPriceInBlock = totalGasPriceInBlock.add(tx.gasPrice);
          transactionCountInBlock++;
        }
      }

      const avgGasPriceInBlock = transactionCountInBlock > 0
        ? totalGasPriceInBlock.div(BigNumber.from(transactionCountInBlock))
        : BigNumber.from(0);

      blockGasPrices.push(avgGasPriceInBlock);
    }
    const currentGasPrice = blockGasPrices[0];
let totalGasPrice = BigNumber.from(0);
for (let i = 0; i < blockGasPrices.length; i++) {
totalGasPrice = totalGasPrice.add(blockGasPrices[i]);
}
const avgGasPrice = totalGasPrice.div(BigNumber.from(blockGasPrices.length));
console.log(`getGasPriceInfo: currentGasPrice = ${currentGasPrice}, avgGasPrice = ${avgGasPrice}`);
return { currentGasPrice, avgGasPrice };
}
export async function ensureHigherEffectiveGasPrice(transactionGasPrice: BigNumber, tailTransactionGasPrice: BigNumber): Promise<BigNumber> {
  const effectiveGasPrice = transactionGasPrice.gt(tailTransactionGasPrice) ? transactionGasPrice : tailTransactionGasPrice.add(1);
  console.log(`ensureHigherEffectiveGasPrice: transactionGasPrice = ${transactionGasPrice}, tailTransactionGasPrice = ${tailTransactionGasPrice}, effectiveGasPrice = ${effectiveGasPrice}`);
  return effectiveGasPrice;
}

// async function checkBundleGas(bundleGas: BigNumber): Promise<boolean> {
//   const isValid = bundleGas.gte(42000);
//   console.log(`checkBundleGas: bundleGas = ${bundleGas}, isValid = ${isValid}`);
//   return isValid;
// }
interface Block {
  bundleGasPrice: BigNumber;
}

interface BlocksApi {
  getRecentBlocks: () => Promise<Block[]>;
}

export async function monitorCompetingBundlesGasPrices(blocksApi: BlocksApi): Promise<Array<BigNumber>> {
  console.log("Entering monitorCompetingBundlesGasPrices");
  const recentBlocks = await blocksApi.getRecentBlocks();
  const competingBundlesGasPrices = recentBlocks.map((block: Block) => block.bundleGasPrice);
  console.log(`monitorCompetingBundlesGasPrices: competingBundlesGasPrices = ${competingBundlesGasPrices}`);
  return competingBundlesGasPrices;
}
export class Arbitrage {
  constructor(
      private wallet: Wallet,
      private flashbotsProvider: FlashbotsBundleProvider,
      private bundleExecutorContract: Contract
  ) {}

    async evaluateMarkets(_marketsByToken: MarketsByToken): Promise<CrossedMarketDetails[]> {
        // Implement market evaluation logic
        return [];
    }

    async takeCrossedMarkets(_markets: CrossedMarketDetails[], _currentBlock: number, _maxAttempts: number): Promise<void> {
        // Implement arbitrage execution logic
    }

    async getOutputAmount(
        dexAddress: string,
        tokenIn: string,
        tokenOut: string,
        amountIn: BigNumber
    ): Promise<BigNumber> {
        // Get the market for this DEX
        const market = await this.getMarketForDex(dexAddress);
        if (!market) {
            throw new Error(`No market found for DEX ${dexAddress}`);
        }

        // Get the output amount using the market's getTokensOut method
        return market.getTokensOut(tokenIn, tokenOut, amountIn);
    }

    async executeArbitrage(
        sourceRouter: string,
        targetRouter: string,
        tokenIn: string,
        _tokenOut: string,
        amountIn: BigNumber
    ): Promise<ArbitrageTransaction>  {
        // Create the arbitrage transaction
        const markets: CrossedMarketDetails[] = [{
            marketPairs: [{
                buyFromMarket: await this.getMarketForDex(sourceRouter) as EthMarket,
                sellToMarket: await this.getMarketForDex(targetRouter) as EthMarket
            }],
            profit: BigNumber.from(0), // This will be calculated during execution
            volume: amountIn,
            tokenAddress: tokenIn,
            buyFromMarket: await this.getMarketForDex(sourceRouter) as EthMarket,
            sellToMarket: await this.getMarketForDex(targetRouter) as EthMarket
        }];

        // Execute the arbitrage using takeCrossedMarkets
        await this.takeCrossedMarkets(markets, await this.getCurrentBlock(), 1);

        // Return a mock transaction response for now
        // In a real implementation, this should return the actual transaction
        return {
            hash: `0x${Math.random().toString(16).slice(2)}`,
            wait: async () => ({ blockNumber: await this.getCurrentBlock() })
        };
    }

    private async getMarketForDex(_dexAddress: string): Promise<EthMarket | null> {
        // This should be implemented to return the appropriate market instance
        // based on the DEX address
        return null;
    }

    private async getCurrentBlock(): Promise<number> {
        const provider = this.wallet.provider;
        const block = await provider.getBlock("latest");
        return block.number;
    }

    async updatePrices(dexAddress: string): Promise<void> {
        const market = await this.getMarketForDex(dexAddress);
        if (!market) {
            throw new Error(`No market found for DEX ${dexAddress}`);
        }
        // Update market prices by fetching latest reserves
        await Promise.all(market.tokens.map(token =>
            market.getReserves(token)
        ));
    }

    async getTokenPair(dexAddress: string): Promise<{ token0: string, token1: string } | null> {
        const market = await this.getMarketForDex(dexAddress);
        if (!market || market.tokens.length < 2) {
            return null;
        }
        return {
            token0: market.tokens[0],
            token1: market.tokens[1]
        };
    }
}

// async function fetchWETHBalance(address: string, provider: Provider, retries = 5, delayMs = 500): Promise<BigNumber | null> {
//   const WETH_CONTRACT_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
//   const ABI = [
//     "function balanceOf(address owner) view returns (uint256)"
//   ];
//   const contract = new Contract(WETH_CONTRACT_ADDRESS, ABI, provider);

//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       const balance: BigNumber = await contract.balanceOf(address);
//       return balance;
//     } catch (error: any) {
//       console.error(`Attempt ${attempt} - Failed to fetch WETH balance for address ${address}:`, error.message);
//       if (attempt < retries) {
//         await new Promise(res => setTimeout(res, delayMs * attempt));
//       } else {
//         console.error(`All ${retries} attempts failed for address ${address}`);
//         return null;
//       }
//     }
//   }
//   return null;
// }
