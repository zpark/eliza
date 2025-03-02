import type { Plugin } from "@elizaos/core";
import { TradingService } from "./services/tradingService";

export const degenTraderPlugin: Plugin = {
  name: "Degen Trader Plugin",
  description: "Autonomous trading agent plugin",
  evaluators: [],
  providers: [],
  actions: [],
  services: [new TradingService()]
}

export default degenTraderPlugin;