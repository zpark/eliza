import type { Plugin } from "@elizaos/core";
import { perpTrade } from "./actions/perpTrade";
import accountSummary from "./actions/accountSummary";

export const deskExchangePlugin: Plugin = {
    name: "deskExchange",
    description: "DESK Exchange plugin",
    actions: [perpTrade, accountSummary],
    providers: [],
    evaluators: [],
    services: [],
    clients: [],
};

export default deskExchangePlugin;
