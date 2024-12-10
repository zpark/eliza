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
import { DeployContractParams } from "../types";
import { ClientProvider } from "../providers/client";
import { ContractActions } from "./contractActions";

export const deployContractTemplate = `
# Task: Determine the contract code and constructor arguments for deploying a contract.

# Instructions: The user is requesting to deploy a contract to the GenLayer protocol.

Here is the user's request:
{{userMessage}}

# Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "code": "<Contract Code>",
  "args": [<Constructor Args>],
  "leaderOnly": <true/false>
}
\`\`\`
`;

const getDeployParams = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
): Promise<DeployContractParams | null> => {
    const context = composeContext({
        state: {
            userMessage: message.content.text,
        } as unknown as State,
        template: deployContractTemplate,
    });

    for (let i = 0; i < 5; i++) {
        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        const parsedResponse = parseJSONObjectFromText(
            response
        ) as DeployContractParams | null;
        if (parsedResponse) {
            return parsedResponse;
        }
    }
    return null;
};

export const deployContractAction: Action = {
    name: "DEPLOY_CONTRACT",
    similes: ["DEPLOY_CONTRACT"],
    description: "Deploy a contract to the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ContractActions(clientProvider);
        const options = await getDeployParams(runtime, message, state);
        if (!options)
            throw new Error("Failed to parse deploy contract parameters");
        return action.deployContract(options);
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deploy a new contract with code 'contract MyContract { uint256 value; function set(uint256 v) public { value = v; } }' and no constructor arguments",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Deploying contract...",
                    action: "DEPLOY_CONTRACT",
                },
            },
        ],
    ],
};
