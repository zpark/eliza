import { Plugin } from "@ai16z/eliza";
import { clientProvider } from "./providers/client";
import { readContractAction } from "./actions/readContract";
import {
    writeContractAction,
    deployContractAction,
    getTransactionAction,
    getCurrentNonceAction,
    waitForTransactionReceiptAction,
    getContractSchemaAction,
} from "./actions/contractActions";

export const genLayerPlugin: Plugin = {
    name: "genlayer",
    description: "Plugin for interacting with GenLayer protocol",
    actions: [
        readContractAction,
        writeContractAction,
        deployContractAction,
        getTransactionAction,
        getCurrentNonceAction,
        waitForTransactionReceiptAction,
        getContractSchemaAction,
    ],
    evaluators: [],
    providers: [clientProvider],
};

export default genLayerPlugin;
