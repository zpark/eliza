import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import { TransactionHash } from "genlayer-js/types";
import { ClientProvider } from "../providers/client";

export const waitForTransactionReceiptAction: Action = {
    name: "WAIT_FOR_TRANSACTION_RECEIPT",
    similes: ["WAIT_FOR_TRANSACTION_RECEIPT"],
    description: "Wait for a transaction receipt from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const clientProvider = new ClientProvider(runtime);
        // Extract transaction hash from message
        const hashMatch = message.content.text.match(/0x[a-fA-F0-9]{64}/);
        if (!hashMatch)
            throw new Error("No valid transaction hash found in message");
        return clientProvider.client.waitForTransactionReceipt({
            hash: hashMatch[0] as TransactionHash,
        });
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Wait for receipt of transaction 0x1234567890123456789012345678901234567890123456789012345678901234",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Waiting for transaction receipt...",
                    action: "WAIT_FOR_TRANSACTION_RECEIPT",
                },
            },
        ],
    ],
};
