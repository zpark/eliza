import { Address } from "viem";

interface YakSwapQuote {
    amounts: bigint[];
    adapters: Address[];
    path: Address[];
    gasEstimate: bigint;
}

export type { YakSwapQuote }