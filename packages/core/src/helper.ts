import { AutoTokenizer } from "@huggingface/transformers";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";
import elizaLogger from "./logger.ts";
import { TokenizerType, type IAgentRuntime, type ModelSettings } from "./types.ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";


export function logFunctionCall(functionName: string, runtime?: IAgentRuntime) {
    elizaLogger.info(`Function call: ${functionName}`, {
        functionName,
        runtime: JSON.stringify(runtime?.getModelProvider())
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

    // Choose the truncation method based on tokenizer type
    if (tokenizerType === TokenizerType.Auto) {
        return truncateAuto(tokenizerModel, context, maxTokens);
    }

    if (tokenizerType === TokenizerType.TikToken) {
        return truncateTiktoken(
            tokenizerModel as TiktokenModel,
            context,
            maxTokens
        );
    }

    elizaLogger.warn(`Unsupported tokenizer type: ${tokenizerType}`);
    return truncateTiktoken("gpt-4o", context, maxTokens);
}




async function truncateAuto(
    modelPath: string,
    context: string,
    maxTokens: number
) {
    try {
        const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
        const tokens = tokenizer.encode(context);

        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return context;
        }

        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);

        // Decode back to text - js-tiktoken decode() returns a string directly
        return tokenizer.decode(truncatedTokens);
    } catch (error) {
        elizaLogger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
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
        elizaLogger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
}


export async function splitChunks(
    content: string,
    chunkSize = 512,
    bleed = 20
): Promise<string[]> {
    elizaLogger.debug("[splitChunks] Starting text split");

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(bleed),
    });

    const chunks = await textSplitter.splitText(content);
    elizaLogger.debug("[splitChunks] Split complete:", {
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