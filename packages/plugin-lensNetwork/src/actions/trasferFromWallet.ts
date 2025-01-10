import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
    elizaLogger,
    composeContext,
    generateObject,
} from "@elizaos/core";
import { z } from "zod";
import { validateLensConfig } from "../environment";
import { isAddress } from "viem";

// Enhanced schema with stricter validation
const TransferSchema = z.object({
    recipient: z.string().refine(
        (val) => isAddress(val),
        { message: "Invalid Ethereum address format" }
    ),
    amount: z.string().refine(
        (val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
        },
        { message: "Amount must be a positive number" }
    ),
});

export interface TransferContent extends Content {
    recipient: string;
    amount: string | number;
}

// Enhanced validation function
export function isTransferContent(
    content: TransferContent
): content is TransferContent {
    try {
        // Check if content exists
        if (!content || !content.recipient || content.amount === undefined) {
            elizaLogger.error("Missing required transfer content");
            return false;
        }

        // Validate types
        if (typeof content.recipient !== "string" ||
            (typeof content.amount !== "string" && typeof content.amount !== "number")) {
            elizaLogger.error("Invalid content types");
            return false;
        }

        // Validate address format
        if (!content.recipient.startsWith("0x") ||
            content.recipient.length !== 42 ||
            !isAddress(content.recipient)) {
            elizaLogger.error("Invalid recipient address format");
            return false;
        }

        // Validate amount
        const amountNum = typeof content.amount === "string" ?
            parseFloat(content.amount) : content.amount;

        if (isNaN(amountNum) || amountNum <= 0) {
            elizaLogger.error("Invalid amount");
            return false;
        }

        return true;
    } catch (error) {
        elizaLogger.error("Validation error:", error);
        return false;
    }
}

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Extract the following information about the requested token transfer:
- Recipient wallet address (must be a valid Ethereum address)
- Amount of Grass to transfer (must be a positive number)

Example response:
\`\`\`json
{
    "recipient": "0xCCa8009f5e09F8C5dB63cb0031052F9CB635Af62",
    "amount": "1000"
}
\`\`\`

{{recentMessages}}`;

export default {
    name: "SIMULATE_GRASS_TRANSFER",
    similes: [
        "TRANSFER_GRASS",
        "SEND_GRASS",
        "MOVE_GRASS",
        "PAY_GRASS",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateLensConfig(runtime);
        return true;
    },
    description: "Simulate transferring Grass tokens to another address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting simulated Grass transfer handler with validation...");

        try {
            // Initialize or update state
            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }

            // Compose transfer context
            const transferContext = composeContext({
                state,
                template: transferTemplate,
            });

            // Generate and validate transfer content
            const content = (
                await generateObject({
                    runtime,
                    context: transferContext,
                    modelClass: ModelClass.SMALL,
                    schema: TransferSchema,
                })
            ).object as unknown as TransferContent;

            // Additional validation check
            if (!isTransferContent(content)) {
                throw new Error("Transfer content validation failed");
            }

            // Log validation success
            elizaLogger.log("Transfer content validated successfully");

            // Format amount to handle both string and number types
            const formattedAmount = typeof content.amount === "string" ?
                content.amount :
                content.amount.toString();

            // Log the simulation success
            elizaLogger.success(
                `[SIMULATION] Transfer validation passed: ${formattedAmount} Grass to ${content.recipient}`
            );

            // Return transfer details for confirmation
            if (callback) {
                callback({
                    text: `Please confirm in your wallet: Transfer of ${formattedAmount} Grass to ${content.recipient}
                    [handleTransfer,${content.recipient} ,${formattedAmount}]`,
                    content: {
                        simulatedTransfer: [formattedAmount, content.recipient]
                    },
                });
            }

            return true;

        } catch (error) {
            elizaLogger.error("Error in transfer validation/simulation:", error);
            if (callback) {
                callback({
                    text: `Unable to process transfer: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Transfer 1 Grass to 0xCCa8009f5e09F8C5dB63cb0031052F9CB635Af62",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Please confirm in your wallet: Transfer of 1 Grass to 0xCCa8009f5e09F8C5dB63cb0031052F9CB635Af62",
                    action: "SIMULATE_GRASS_TRANSFER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send 0.5 Grass to 0xbD8679cf79137042214fA4239b02F4022208EE82",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Please confirm in your wallet: Transfer of 0.5 Grass to 0xbD8679cf79137042214fA4239b02F4022208EE82",
                    action: "SIMULATE_GRASS_TRANSFER",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;