import type { Plugin } from "@elizaos/core";
import { perpTrade } from "./actions/perpTrade";

export const deskExchangePlugin: Plugin = {
    name: "deskExchange",
    description: "DESK Exchange plugin",
    actions: [perpTrade],
    providers: [],
    evaluators: [],
    services: [],
    clients: [],
};

export default deskExchangePlugin;
