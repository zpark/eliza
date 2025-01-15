import { Plugin } from "@elizaos/core";
import { getScoreAction } from "./actions/getScore.ts";

export * as actions from "./actions/index.ts";
export * as evaluators from "./evaluators/index.ts";
export * as providers from "./providers/index.ts";

export const swiprPlugin: Plugin = {
    name: "swipr",
    description: "Swipr plugin for ElizaOS",
    actions: [getScoreAction],
    evaluators: [],
    providers: [],
};
export default swiprPlugin;
