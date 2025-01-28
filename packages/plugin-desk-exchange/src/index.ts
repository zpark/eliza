import type { Plugin } from "@elizaos/core";
import { spotTrade } from "./actions/spotTrade";

export const deskExchangePlugin: Plugin = {
    name: "deskExchange",
    description: "DESK Exchange plugin",
    actions: [spotTrade],
    providers: [],
    evaluators: [],
    services: [],
    clients: [],
};

export default deskExchangePlugin;
