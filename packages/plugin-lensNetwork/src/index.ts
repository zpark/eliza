import { Plugin } from "@elizaos/core";

import transfer from "./actions/transfer.ts";


export const LensPlugin: Plugin = {
    name: "Lens",
    description: "Lens Plugin for Eliza",
    actions: [transfer],
    evaluators: [],
    providers: [],
};

export default LensPlugin;
