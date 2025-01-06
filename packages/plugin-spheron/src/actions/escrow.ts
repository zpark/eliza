import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger,
    composeContext,
    generateObject,
    ModelClass,
} from "@elizaos/core";
import { validateSpheronConfig } from "../environment";
import { depositBalance, getUserBalance, withdrawBalance } from "../utils";
import { EscrowContent } from "../types";
import { SUPPORTED_TOKENS } from "../utils/constants";

function isEscrowContent(content: any): content is EscrowContent {
    elizaLogger.debug("Content for escrow operation:", content);
    return (
        typeof content.token === "string" &&
        typeof content.amount === "number" &&
        (content.operation === "deposit" ||
            content.operation === "withdraw" ||
            content.operation === "check")
    );
}

const escrowTemplate = `Respond with a JSON markdown block containing only the extracted values
- Use null for any values that cannot be determined.
- Token must be one of the supported tokens.
- Amount must be a positive number.

Example response for checking balance for USDT:
\`\`\`json
{
    "token": "USDT",
    "operation": "check"
}
\`\`\`

Example response for depositing 100 USDT:
\`\`\`json
{
    "token": "USDT",
    "amount": 100,
    "operation": "deposit"
}
\`\`\`

Example response for withdrawing 50 USDC:
\`\`\`json
{
    "token": "USDC",
    "amount": 50,
    "operation": "withdraw"
}
\`\`\`

## Supported Tokens
${Object.entries(SUPPORTED_TOKENS)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n")}

## Recent Messages

{{recentMessages}}

Given the recent messages, extract the following information about the requested escrow operation:
- Token symbol (must be one of the supported tokens)
- Amount to deposit/withdraw (must be a positive number)
- Operation type (deposit or withdraw)

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "ESCROW_OPERATION",
    similes: [
        "DEPOSIT_TOKEN",
        "WITHDRAW_TOKEN",
        "CHECK_BALANCE",
        "GET_BALANCE",
        "DEPOSIT_FUNDS",
        "WITHDRAW_FUNDS",
        "ADD_FUNDS",
        "REMOVE_FUNDS",
        "TRANSFER_TO_ESCROW",
        "TRANSFER_FROM_ESCROW",
        "FUND_ACCOUNT",
        "WITHDRAW_FROM_ACCOUNT",
    ],
    description:
        "MUST use this action if the user requests to deposit or withdraw tokens from escrow. The request might vary, but it will always be related to escrow operations.",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        await validateSpheronConfig(runtime);
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting ESCROW_OPERATION handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose escrow context
        const escrowContext = composeContext({
            state,
            template: escrowTemplate,
        });

        // Generate escrow content
        const content = await generateObject({
            runtime,
            context: escrowContext,
            modelClass: ModelClass.SMALL,
        });

        elizaLogger.debug("Escrow content:", content);

        // Validate escrow content
        if (!isEscrowContent(content)) {
            elizaLogger.error("Invalid content for ESCROW_OPERATION action.");
            callback?.({
                text: "Unable to process escrow request. Invalid content provided.",
                content: { error: "Invalid escrow content" },
            });
            return false;
        }

        try {
            const config = await validateSpheronConfig(runtime);
            const balance = await getUserBalance(
                runtime,
                content.token,
                config.WALLET_ADDRESS
            );
            elizaLogger.log(`Current ${content.token} balance:`, balance);

            if (content.operation === "check") {
                callback?.({
                    text: `Current ${content.token}\n unlocked balance: ${balance.unlockedBalance} ${content.token}\n locked balance: ${balance.lockedBalance}`,
                    content: {
                        success: true,
                        unlockedBalance: balance.unlockedBalance,
                        lockedBalance: balance.lockedBalance,
                    },
                });
            } else if (content.operation === "deposit") {
                const result = await depositBalance(
                    runtime,
                    content.token,
                    content.amount
                );
                callback?.({
                    text: `Successfully deposited ${content.amount} ${content.token} into escrow`,
                    content: {
                        success: true,
                        transaction: result,
                        operation: "deposit",
                        token: content.token,
                        amount: content.amount,
                        newBalance: await getUserBalance(
                            runtime,
                            content.token,
                            config.WALLET_ADDRESS
                        ),
                    },
                });
            } else if (content.operation === "withdraw") {
                const result = await withdrawBalance(
                    runtime,
                    content.token,
                    content.amount
                );
                callback?.({
                    text: `Successfully withdrew ${content.amount} ${content.token} from escrow`,
                    content: {
                        success: true,
                        transaction: result,
                        operation: "withdraw",
                        token: content.token,
                        amount: content.amount,
                        newBalance: await getUserBalance(
                            runtime,
                            content.token,
                            config.WALLET_ADDRESS
                        ),
                    },
                });
            } else {
                throw new Error("Invalid operation");
            }

            return true;
        } catch (error) {
            elizaLogger.error("Escrow operation failed:", error);
            callback?.({
                text: "Escrow operation failed",
                content: {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deposit 100 USDT into escrow",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Processing your deposit of 100 USDT...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Withdraw 50 USDC from my balance",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Processing your withdrawal of 50 USDC...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Add 200 DAI to my account",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Processing your deposit of 200 DAI...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check agent's escrow USDT balance",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Checking your USDT balance...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "How much DAI do I have in agent's escrow?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check your DAI balance...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Transfer 75 USDC to escrow",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Processing your deposit of 75 USDC...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to remove 150 DAI from escrow",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Processing your withdrawal of 150 DAI...",
                    action: "ESCROW_OPERATION",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
