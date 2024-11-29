import { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback } from "@ai16z/eliza";

const myTransferAction = () => console.log("Transfer action")

export default {
    name: "SEND_TOKEN",
    similes: ["TRANSFER_TOKEN_ON_AVALANCHE", "TRANSFER_TOKENS_ON_AVALANCHE", "SEND_TOKENS_ON_AVALANCHE", "SEND_ETH_ON_AVALANCHE", "PAY_ON_AVALANCHE"],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "MUST use this action if the user requests send a token or transfer a token, the request might be varied, but it will always be a token transfer. If the user requests a transfer of lords, use this action.",
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: { [key: string]: unknown }, callback?: HandlerCallback) => {
        console.log("Transfer action handler")
        // const character = runtime.character
        // console.log("character", character)
        console.log("AVALANCHE_PRIVATE_KEY", runtime.getSetting("AVALANCHE_PRIVATE_KEY"))
        myTransferAction()
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Send 10 AVAX to 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
            },
        ],
    ] as ActionExample[][],
} as Action;