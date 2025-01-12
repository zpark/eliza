import { webSearch } from "./actions";
import { Plugin } from "@elizaos/core";

export const webSearchPlugin: Plugin = {
    name: "webSearch",
    description: "Search web",
    actions: [webSearch],
    evaluators: [],
    providers: [],
};

export default webSearchPlugin;
