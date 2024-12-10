import { Plugin } from "@ai16z/eliza";
import { clientProvider } from "./providers/client";
import { readContractAction } from "./actions/readContract";

export const genLayerPlugin: Plugin = {
    name: "genlayer",
    description: "Plugin for interacting with GenLayer protocol",
    actions: [readContractAction],
    evaluators: [],
    providers: [clientProvider],
};

export default genLayerPlugin;
