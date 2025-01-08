export * from "./environment";
export * from "./providers/asterai.provider";

import type { Plugin } from "@elizaos/core";
import { queryAction } from "./actions/query";

export const asteraiPlugin: Plugin = {
    name: "asterai",
    description: "asterai Plugin for Eliza",
    providers: [/*todo*/],
    actions: [queryAction],
    evaluators: [],
    services: [],
};

export default asteraiPlugin;
