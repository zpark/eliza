import {
    Action,
    composeContext,
    generateText,
    IAgentRuntime,
    Memory,
    ModelClass,
    parseJSONObjectFromText,
    State,
} from "@ai16z/eliza";
import { ReadContractParams } from "../types";
import { ClientProvider } from "../providers/client";

export const readContractTemplate = `
# Task: Determine the contract address, function name, and function arguments to read from the contract.

# Instructions: The user is requesting to read a contract from the GenLayer protocol.

Here is the user's request:
{{userMessage}}

# Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "contractAddress": "<Contract Address>",
  "functionName": "<Function Name>",
  "functionArgs": [<Function Args>]
}
\`\`\`
`;

const getReadParams = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
): Promise<ReadContractParams> => {
    // console.error("getReadParams", message, state);

    // TODO: evaluate adding the whole state to allow requests among many messages
    const context = composeContext({
        state: {
            // ...state,
            userMessage: message.content.text,
        } as unknown as State, // copied approach from joinvoice.ts
        template: readContractTemplate,
    });

    for (let i = 0; i < 5; i++) {
        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });
        console.log("response", response);

        const parsedResponse = parseJSONObjectFromText(
            response
        ) as ReadContractParams | null;

        if (parsedResponse) {
            return parsedResponse;
        }
    }
    return null;
};
export class ReadContractAction {
    private readonly provider: ClientProvider;
    constructor(provider: ClientProvider) {
        this.provider = provider;
    }

    async readContract(options: ReadContractParams) {
        const out = await this.provider.client.readContract({
            address: options.contractAddress,
            functionName: options.functionName,
            args: options.functionArgs,
        });
        console.error("out", out);
        return out;
    }
}

export const readContractAction: Action = {
    name: "READ_CONTRACT",
    similes: ["READ_CONTRACT"],
    description: "Read a contract from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ReadContractAction(clientProvider);
        const options = await getReadParams(runtime, message, state);
        console.error(`options: ${JSON.stringify(options)}`);
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
