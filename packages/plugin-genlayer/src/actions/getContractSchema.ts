import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import { ClientProvider } from "../providers/client";
import { ContractActions } from "./contractActions";

export const getContractSchemaAction: Action = {
    name: "GET_CONTRACT_SCHEMA",
    similes: ["GET_CONTRACT_SCHEMA"],
    description: "Get contract schema from the GenLayer protocol",
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
        return action.getContractSchema({ address: addressMatch[0] });
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get contract schema for address 0xE2632a044af0Bc2f0a1ea1E9D9694cc1e1783208",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the contract schema:",
                    action: "GET_CONTRACT_SCHEMA",
                },
            },
        ],
    ],
};
