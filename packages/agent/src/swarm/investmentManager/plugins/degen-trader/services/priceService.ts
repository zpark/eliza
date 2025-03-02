import { elizaLogger } from "@elizaos/core";
import { IAgentRuntime } from "@elizaos/core";
import { PriceSignalMessage } from "../types";
import { SonarClient } from "./sonarClient";

export async function handlePriceSignal(
  signal: PriceSignalMessage,
  runtime: IAgentRuntime,
  sonarClient: SonarClient
): Promise<void> {
  elizaLogger.info('Price update received:', {
    token: signal.tokenAddress,
    initialPrice: signal.initialPrice,
    currentPrice: signal.currentPrice,
    priceChange: `${signal.priceChange}%`
  });
}