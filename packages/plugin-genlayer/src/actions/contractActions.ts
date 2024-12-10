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
import {
    WriteContractParams,
    DeployContractParams,
    GetTransactionParams,
    GetCurrentNonceParams,
    WaitForTransactionReceiptParams,
    GetContractSchemaParams,
    GetContractSchemaForCodeParams,
} from "../types";
import { ClientProvider } from "../providers/client";
import { TransactionHash } from "genlayer-js/types";

// Template for write contract parameters
const writeContractTemplate = `
# Task: Determine the contract address, function name, function arguments, and value for writing to the contract.

# Instructions: The user is requesting to write to a contract in the GenLayer protocol.

Here is the user's request:
{{userMessage}}

# Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "contractAddress": "<Contract Address>",
  "functionName": "<Function Name>",
  "functionArgs": [<Function Args>],
  "value": "<Value in BigInt>",
  "leaderOnly": <true/false>
}
\`\`\`
`;

// Template for deploy contract parameters
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

const getParamsFromTemplate = async <T>(
    runtime: IAgentRuntime,
    message: Memory,
    template: string
): Promise<T | null> => {
    const context = composeContext({
        state: {
            userMessage: message.content.text,
        } as unknown as State,
        template,
    });

    for (let i = 0; i < 5; i++) {
        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        const parsedResponse = parseJSONObjectFromText(response) as T | null;
        if (parsedResponse) {
            return parsedResponse;
        }
    }
    return null;
};

export class ContractActions {
    private readonly provider: ClientProvider;

    constructor(provider: ClientProvider) {
        this.provider = provider;
    }

    async writeContract(options: WriteContractParams) {
        return this.provider.client.writeContract({
            address: options.contractAddress,
            functionName: options.functionName,
            args: options.functionArgs,
            value: options.value,
            leaderOnly: options.leaderOnly,
        });
    }

    async deployContract(options: DeployContractParams) {
        return this.provider.client.deployContract({
            code: options.code,
            args: options.args,
            leaderOnly: options.leaderOnly,
        });
    }

    async getTransaction(options: GetTransactionParams) {
        return this.provider.client.getTransaction({
            hash: options.hash,
        });
    }

    async getCurrentNonce(options: GetCurrentNonceParams) {
        return this.provider.client.getCurrentNonce({
            address: options.address,
        });
    }

    async waitForTransactionReceipt(options: WaitForTransactionReceiptParams) {
        return this.provider.client.waitForTransactionReceipt({
            hash: options.hash,
            status: options.status,
            interval: options.interval,
            retries: options.retries,
        });
    }

    async getContractSchema(options: GetContractSchemaParams) {
        return this.provider.client.getContractSchema(options.address);
    }

    async getContractSchemaForCode(options: GetContractSchemaForCodeParams) {
        return this.provider.client.getContractSchemaForCode(
            options.contractCode
        );
    }
}

export const writeContractAction: Action = {
    name: "WRITE_CONTRACT",
    similes: ["WRITE_CONTRACT"],
    description: "Write to a contract in the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ContractActions(clientProvider);
        const options = await getParamsFromTemplate<WriteContractParams>(
            runtime,
            message,
            writeContractTemplate
        );
        if (!options)
            throw new Error("Failed to parse write contract parameters");
        return action.writeContract(options);
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Write to the GenLayer contract at 0xE2632a044af0Bc2f0a1ea1E9D9694cc1e1783208 by calling `set_value` with argument 42 and value 0",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Writing to contract with set_value(42)",
                    action: "WRITE_CONTRACT",
                },
            },
        ],
    ],
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
        const options = await getParamsFromTemplate<DeployContractParams>(
            runtime,
            message,
            deployContractTemplate
        );
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

export const getTransactionAction: Action = {
    name: "GET_TRANSACTION",
    similes: ["GET_TRANSACTION"],
    description: "Get transaction details from the GenLayer protocol",
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("GENLAYER_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const clientProvider = new ClientProvider(runtime);
        const action = new ContractActions(clientProvider);
        // Extract transaction hash from message
        const hashMatch = message.content.text.match(/0x[a-fA-F0-9]{64}/);
        if (!hashMatch)
            throw new Error("No valid transaction hash found in message");
        return action.getTransaction({ hash: hashMatch[0] as TransactionHash });
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
        const action = new ContractActions(clientProvider);
        // Extract transaction hash from message
        const hashMatch = message.content.text.match(/0x[a-fA-F0-9]{64}/);
        if (!hashMatch)
            throw new Error("No valid transaction hash found in message");
        return action.waitForTransactionReceipt({
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
