import { Action, IAgentRuntime, Memory, Plugin, State } from "@ai16z/eliza";
import { ClientProvider } from "./providers/client";
import { ReadContractParams } from "./types";

export class ReadContractAction {
    private readonly provider: ClientProvider;
    constructor(provider: ClientProvider) {
        this.provider = provider;
    }

    async readContract(options: ReadContractParams) {
        return this.provider.client.readContract({
            address: options.contractAddress,
            functionName: options.functionName,
            args: options.functionArgs,
        });
    }
}

const readContractAction: Action = {
    name: "READ_CONTRACT",
    similes: ["READ_CONTRACT"],
    description: "Read a contract from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any
    ) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ReadContractAction(clientProvider);
        console.error(options);
        console.error(
            `Reading contract ${options.contractAddress} with function ${options.functionName} and args ${options.functionArgs}`
        );
        return action.readContract(options);
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Read the GenLayer contract at 0xE2632a044af0Bc2f0a1ea1E9D9694cc1e1783208 by calling `get_have_coin` with no arguments",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the output of the contract call:",
                    action: "READ_CONTRACT",
                },
            },
        ],
    ],
};

export const genLayerPlugin: Plugin = {
    name: "genlayer",
    description: "Plugin for interacting with GenLayer protocol",
    actions: [readContractAction],
    evaluators: [],
    providers: [],
};

export default genLayerPlugin;
