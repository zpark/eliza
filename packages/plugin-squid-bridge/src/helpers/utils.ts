import { IAgentRuntime } from "@elizaos/core";
import { z } from 'zod';
import { ethers } from 'ethers';
import { bech32 } from 'bech32';
import bs58 from 'bs58';
import {SquidToken, XChainSwapContent} from "../types";

export function convertToWei(amount: string | number, token: SquidToken): string {
    if (typeof token.decimals !== 'number' || token.decimals < 0 || token.decimals > 255) {
        throw new Error("Invalid decimals value in token object.");
    }

    try {
        // Ensure amount is a string for ethers.js
        const amountString = typeof amount === 'number' ? amount.toString() : amount;

        // Use ethers.js to parse the amount into the smallest unit
        const parsedAmount = ethers.utils.parseUnits(amountString, token.decimals);

        // Return the parsed amount as a string
        return parsedAmount.toString();
    } catch (error) {
        throw new Error(`Failed to convert amount: ${(error as Error).message}`);
    }
}


export function isXChainSwapContent(
    content: XChainSwapContent
): content is XChainSwapContent {
    // Validate types
    const validTypes =
        typeof content.fromChain === "string" &&
        typeof content.toChain === "string" &&
        typeof content.fromToken === "string" &&
        typeof content.toToken === "string" &&
        typeof content.toAddress === "string" &&
        (typeof content.amount === "string" ||
            typeof content.amount === "number");
    if (!validTypes) {
        return false;
    }
}

// Helper Validation Functions

const isValidEvmAddress = (address: string): boolean => {
    return ethers.utils.isAddress(address);
};

const isValidEvmPrivateKey = (key: string): boolean => {
    const cleanedKey = key.startsWith('0x') ? key.slice(2) : key;
    return /^[0-9a-fA-F]{64}$/.test(cleanedKey);
};

const isValidSolanaAddress = (address: string): boolean => {
    try {
        const decoded = bs58.decode(address);
        return decoded.length === 32; // Corrected from 32 || 44 to only 32
    } catch {
        return false;
    }
};

const isValidSolanaPrivateKey = (key: string): boolean => {
    return /^[0-9a-fA-F]{64}$/.test(key);
};

const isValidCosmosAddress = (address: string): boolean => {
    try {
        const decoded = bech32.decode(address);
        return decoded.prefix.startsWith('cosmos') && decoded.words.length === 52;
    } catch {
        return false;
    }
};

const isValidCosmosPrivateKey = (key: string): boolean => {
    return /^[0-9a-fA-F]{64}$/.test(key);
};

export const squidRouterEnvSchema = z
    .object({
        SQUID_INTEGRATOR_ID: z.string().min(1, "Squid Integrator ID is required"),
        SQUID_SDK_URL: z.string().min(1, "Squid SDK URL is required"),

        EVM_ADDRESS: z.string().optional(),
        EVM_PRIVATE_KEY: z.string().optional(),

        SOLANA_ADDRESS: z.string().optional(),
        SOLANA_PRIVATE_KEY: z.string().optional(),

        COSMOS_ADDRESS: z.string().optional(),
        COSMOS_PRIVATE_KEY: z.string().optional(),
    })
    .refine((data) => {
        // Check if EVM pair is valid
        const evmValid =
            (data.EVM_ADDRESS && data.EVM_PRIVATE_KEY) &&
            isValidEvmAddress(data.EVM_ADDRESS) &&
            isValidEvmPrivateKey(data.EVM_PRIVATE_KEY);

        // Check if Solana pair is valid
        const solanaValid =
            (data.SOLANA_ADDRESS && data.SOLANA_PRIVATE_KEY) &&
            isValidSolanaAddress(data.SOLANA_ADDRESS) &&
            isValidSolanaPrivateKey(data.SOLANA_PRIVATE_KEY);

        // Check if Cosmos pair is valid
        const cosmosValid =
            (data.COSMOS_ADDRESS && data.COSMOS_PRIVATE_KEY) &&
            isValidCosmosAddress(data.COSMOS_ADDRESS) &&
            isValidCosmosPrivateKey(data.COSMOS_PRIVATE_KEY);

        return evmValid || solanaValid || cosmosValid;
    }, {
        message: "At least one valid address and private key pair is required: EVM, Solana, or Cosmos.",
        path: [], // Global error
    })
    .superRefine((data, ctx) => {
        // EVM Validation
        if (data.EVM_ADDRESS || data.EVM_PRIVATE_KEY) {
            if (data.EVM_ADDRESS && !isValidEvmAddress(data.EVM_ADDRESS)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "EVM_ADDRESS is invalid or not checksummed correctly.",
                    path: ["EVM_ADDRESS"],
                });
            }

            if (data.EVM_PRIVATE_KEY && !isValidEvmPrivateKey(data.EVM_PRIVATE_KEY)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "EVM_PRIVATE_KEY must be a 64-character hexadecimal string.",
                    path: ["EVM_PRIVATE_KEY"],
                });
            }

            if ((data.EVM_ADDRESS && !data.EVM_PRIVATE_KEY) || (!data.EVM_ADDRESS && data.EVM_PRIVATE_KEY)) {
                if (!data.EVM_ADDRESS) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "EVM_ADDRESS is required when EVM_PRIVATE_KEY is provided.",
                        path: ["EVM_ADDRESS"],
                    });
                }
                if (!data.EVM_PRIVATE_KEY) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "EVM_PRIVATE_KEY is required when EVM_ADDRESS is provided.",
                        path: ["EVM_PRIVATE_KEY"],
                    });
                }
            }
        }

        // Solana Validation
        if (data.SOLANA_ADDRESS || data.SOLANA_PRIVATE_KEY) {
            if (data.SOLANA_ADDRESS && !isValidSolanaAddress(data.SOLANA_ADDRESS)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "SOLANA_ADDRESS is invalid.",
                    path: ["SOLANA_ADDRESS"],
                });
            }

            if (data.SOLANA_PRIVATE_KEY && !isValidSolanaPrivateKey(data.SOLANA_PRIVATE_KEY)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "SOLANA_PRIVATE_KEY must be a 64-character hexadecimal string.",
                    path: ["SOLANA_PRIVATE_KEY"],
                });
            }

            if ((data.SOLANA_ADDRESS && !data.SOLANA_PRIVATE_KEY) || (!data.SOLANA_ADDRESS && data.SOLANA_PRIVATE_KEY)) {
                if (!data.SOLANA_ADDRESS) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "SOLANA_ADDRESS is required when SOLANA_PRIVATE_KEY is provided.",
                        path: ["SOLANA_ADDRESS"],
                    });
                }
                if (!data.SOLANA_PRIVATE_KEY) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "SOLANA_PRIVATE_KEY is required when SOLANA_ADDRESS is provided.",
                        path: ["SOLANA_PRIVATE_KEY"],
                    });
                }
            }
        }

        // Cosmos Validation
        if (data.COSMOS_ADDRESS || data.COSMOS_PRIVATE_KEY) {
            if (data.COSMOS_ADDRESS && !isValidCosmosAddress(data.COSMOS_ADDRESS)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "COSMOS_ADDRESS is invalid.",
                    path: ["COSMOS_ADDRESS"],
                });
            }

            if (data.COSMOS_PRIVATE_KEY && !isValidCosmosPrivateKey(data.COSMOS_PRIVATE_KEY)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "COSMOS_PRIVATE_KEY must be a 64-character hexadecimal string.",
                    path: ["COSMOS_PRIVATE_KEY"],
                });
            }

            if ((data.COSMOS_ADDRESS && !data.COSMOS_PRIVATE_KEY) || (!data.COSMOS_ADDRESS && data.COSMOS_PRIVATE_KEY)) {
                if (!data.COSMOS_ADDRESS) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "COSMOS_ADDRESS is required when COSMOS_PRIVATE_KEY is provided.",
                        path: ["COSMOS_ADDRESS"],
                    });
                }
                if (!data.COSMOS_PRIVATE_KEY) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "COSMOS_PRIVATE_KEY is required when COSMOS_ADDRESS is provided.",
                        path: ["COSMOS_PRIVATE_KEY"],
                    });
                }
            }
        }
    });

export type SquidRouterConfig = z.infer<typeof squidRouterEnvSchema>;

export async function validateSquidRouterConfig(
    runtime: IAgentRuntime
): Promise<SquidRouterConfig> {
    try {
        const config = {
            SQUID_INTEGRATOR_ID: runtime.getSetting("SQUID_INTEGRATOR_ID"),
            SQUID_SDK_URL: runtime.getSetting("SQUID_SDK_URL"),
            EVM_ADDRESS: runtime.getSetting("EVM_ADDRESS"),
            EVM_PRIVATE_KEY: runtime.getSetting("EVM_PRIVATE_KEY"),
            SOLANA_ADDRESS: runtime.getSetting("SOLANA_ADDRESS"),
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY"),
            COSMOS_ADDRESS: runtime.getSetting("COSMOS_ADDRESS"),
            COSMOS_PRIVATE_KEY: runtime.getSetting("COSMOS_PRIVATE_KEY"),
        };

        return squidRouterEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Squid Router configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
