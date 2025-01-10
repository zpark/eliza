import { Plugin } from "@elizaos/core";

import transfer from "./actions/transfer.ts";
import trasferFromWallet from "./actions/trasferFromWallet.ts";

export const LensPlugin: Plugin = {
    name: "Lens",
    description: "Lens Plugin for Eliza",
    actions: [transfer,trasferFromWallet],
    evaluators: [],
    providers: [],
};

export default LensPlugin;
