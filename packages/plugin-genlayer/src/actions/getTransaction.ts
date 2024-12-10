import { Action, HandlerCallback, IAgentRuntime, Memory } from "@ai16z/eliza";
import { TransactionHash } from "genlayer-js/types";
import { ClientProvider } from "../providers/client";

export const getTransactionAction: Action = {
    name: "GET_TRANSACTION",
    similes: ["GET_TRANSACTION"],
    description: "Get transaction details from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: any,
        _options: any,
        callback: HandlerCallback
    ) => {
        const clientProvider = new ClientProvider(runtime);
        // Extract transaction hash from message
        const hashMatch = message.content.text.match(/0x[a-fA-F0-9]{64}/);
        if (!hashMatch)
            throw new Error("No valid transaction hash found in message");
        const result = await clientProvider.client.getTransaction({
            hash: hashMatch[0] as TransactionHash,
        });
        await callback(
            {
                text: `Transaction details: ${JSON.stringify(result, null, 2)}`,
            },
            []
        );
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get transaction details for hash 0x1234567890123456789012345678901234567890123456789012345678901234",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are the transaction details:",
                    action: "GET_TRANSACTION",
                },
            },
        ],
    ],
};
