import {squidRouterProvider} from "./providers/squidRouter.ts";

export * from "./actions/xChainSwap.ts";
export * from "./providers/squidRouter.ts";
export * from "./types";

import type { Plugin } from "@elizaos/core";
import { xChainSwapAction } from "./actions/xChainSwap.ts";

export const squidBridgePlugin: Plugin = {
    name: "squid-bridge",
    description: "Squid router bridge plugin",
    providers: [squidRouterProvider],
    evaluators: [],
    services: [],
    actions: [xChainSwapAction],
};

export default squidBridgePlugin;
