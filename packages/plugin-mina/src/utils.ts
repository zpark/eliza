import type { IAgentRuntime } from "@elizaos/core";

import { PrivateKey } from "o1js";

const parseAccount = (runtime: IAgentRuntime): PrivateKey => {
    const privateKey = runtime.getSetting("MINA_PRIVATE_KEY");
    if (!privateKey) {
        throw new Error("MINA_PRIVATE_KEY is not set");
    }
    return PrivateKey.fromBase58(privateKey);
};

export { parseAccount };
