import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import logger from "./logger.ts";
import { type IAgentRuntime, type ModelSettings } from "./types.ts";


export function logFunctionCall(functionName: string, runtime?: IAgentRuntime) {
    logger.info(`Function call: ${functionName}`, {
        functionName,
        // runtime: JSON.stringify(runtime?)
    });
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