import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import { ClientProvider } from "../providers/client";
import { ContractActions } from "./contractActions";

export const getCurrentNonceAction: Action = {
    name: "GET_CURRENT_NONCE",
    similes: ["GET_CURRENT_NONCE"],
    description: "Get current nonce for an address from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ContractActions(clientProvider);
        // Extract address from message
        const addressMatch = message.content.text.match(/0x[a-fA-F0-9]{40}/);
        if (!addressMatch) throw new Error("No valid address found in message");
        return action.getCurrentNonce({ address: addressMatch[0] });
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get current nonce for address 0xE2632a044af0Bc2f0a1ea1E9D9694cc1e1783208",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "The current nonce is:",
                    action: "GET_CURRENT_NONCE",
                },
            },
        ],
    ],
};
