import { encodingForModel, type TiktokenModel } from "js-tiktoken";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import logger from "./logger.ts";
import { type IAgentRuntime, type ModelSettings } from "./types.ts";


export function logFunctionCall(functionName: string, runtime?: IAgentRuntime) {
    logger.info(`Function call: ${functionName}`, {
        functionName,
        // runtime: JSON.stringify(runtime?)
    });
}

export async function trimTokens(
    context: string,
    maxTokens: number,
    runtime: IAgentRuntime
) {
    logFunctionCall('trimTokens', runtime);
    if (!context) return "";
    if (maxTokens <= 0) throw new Error("maxTokens must be positive");

    const tokenizerModel = runtime.getSetting("TOKENIZER_MODEL");
    const tokenizerType = runtime.getSetting("TOKENIZER_TYPE");

    if (!tokenizerModel || !tokenizerType) {
        // Default to TikToken truncation using the "gpt-4o" model if tokenizer settings are not defined
        return truncateTiktoken("gpt-4o", context, maxTokens);
    }

    return truncateTiktoken(
        tokenizerModel as TiktokenModel,
        context,
        maxTokens
    );

    logger.warn(`Unsupported tokenizer type: ${tokenizerType}`);
    return truncateTiktoken("gpt-4o", context, maxTokens);
}

async function truncateTiktoken(
    model: TiktokenModel,
    context: string,
    maxTokens: number
) {
    try {
        const encoding = encodingForModel(model);

        // Encode the text into tokens
        const tokens = encoding.encode(context);

        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return context;
        }

        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);

        // Decode back to text - js-tiktoken decode() returns a string directly
        return encoding.decode(truncatedTokens);
    } catch (error) {
        logger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
}

export async function splitChunks(
    content: string,
    chunkSize = 512,
    bleed = 20
): Promise<string[]> {
    logger.debug("[splitChunks] Starting text split");

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(bleed),
    });

    const chunks = await textSplitter.splitText(content);
    logger.debug("[splitChunks] Split complete:", {
        numberOfChunks: chunks.length,
        averageChunkSize: chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length,
    });

    return chunks;
}

export function getModelSettings(modelSettings: Record<string, ModelSettings>) {
    if (!modelSettings) {
        throw new Error("MODEL_SETTINGS is not defined");
    }
    return modelSettings.defaultModel;
}