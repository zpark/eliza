import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@ai16z/eliza";
import { DeployContractParams } from "../types";
import { ClientProvider } from "../providers/client";
import { getParamsWithLLM } from "../utils/llm";

const deployContractTemplate = `
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

export const deployContractAction: Action = {
    name: "DEPLOY_CONTRACT",
    similes: ["DEPLOY_CONTRACT"],
    description: "Deploy a contract to the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.info("Starting deploy contract action");
        elizaLogger.debug("User message:", message.content.text);

        const clientProvider = new ClientProvider(runtime);
        const options = await getParamsWithLLM<DeployContractParams>(
            runtime,
            message,
            deployContractTemplate
        );

        if (!options) {
            elizaLogger.error("Failed to parse deploy contract parameters");
            throw new Error("Failed to parse deploy contract parameters");
        }

        elizaLogger.debug("Parsed parameters:", options);
        elizaLogger.info(
            "Deploying contract with code length:",
            options.code.length
        );

        const result = await clientProvider.client.deployContract({
            code: options.code,
            args: options.args,
            leaderOnly: options.leaderOnly,
        });

        elizaLogger.success(
            `Successfully deployed contract at address: ${result}`
        );
        await callback(
            {
                text: `Successfully deployed contract at address: ${result}`,
            },
            []
        );
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
