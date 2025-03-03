import { logger } from "@elizaos/core";
import type { IAgentRuntime } from "@elizaos/core";
import type { PriceSignalMessage } from "../types";
import type { SonarClient } from "./sonarClient";

export async function handlePriceSignal(
  signal: PriceSignalMessage,
  _runtime: IAgentRuntime,
  _sonarClient: SonarClient
): Promise<void> {
  logger.info('Price update received:', {
    token: signal.tokenAddress,
    initialPrice: signal.initialPrice,
    currentPrice: signal.currentPrice,
    priceChange: `${signal.priceChange}%`
  });
}