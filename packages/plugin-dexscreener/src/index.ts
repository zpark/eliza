import { Plugin } from "@elizaos/core";
import { TokenPriceAction } from "./actions/tokenAction.ts";
import { TokenPriceEvaluator } from "./evaluators/tokenEvaluator.ts";
import { TokenPriceProvider } from "./providers/tokenProvider.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const dexScreenerPlugin: Plugin = {
    name: "dexscreener",
    description: "Dex Screener Plugin with Token Price Action, Evaluators and Providers",
    actions: [
        new TokenPriceAction()
    ],
    evaluators: [ new TokenPriceEvaluator() ],
    providers: [ new TokenPriceProvider() ]
};
