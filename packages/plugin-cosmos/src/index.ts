export * from "./actions/transfer";

import type { Plugin } from "@ai16z/eliza";
import { transferAction } from "./actions/transfer";

export const cosmosPlugin: Plugin = {
    name: "cosmos",
    description: "Cosmos blockchain integration plugin",
    providers: [],
    evaluators: [],
    services: [],
    actions: [transferAction],
};

export default cosmosPlugin;
