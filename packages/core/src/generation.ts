// ================ IMPORTS ================
import { createOpenAI } from "@ai-sdk/openai";
import {
    generateImage as aiGenerateImage,
    generateObject as aiGenerateObject,
    generateText as aiGenerateText,
    type StepResult as AIStepResult,
    type CoreTool,
    type GenerateObjectResult
} from "ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { z, type ZodSchema } from "zod";
import { elizaLogger, logFunctionCall } from "./index.ts";
import {
    parseJsonArrayFromText,
    parseJSONObjectFromText,
    parseShouldRespondFromText
} from "./parsing.ts";
import settings from "./settings.ts";
import {
    type Content,
    type IAgentRuntime,
    type IImageDescriptionService,
    type IVerifiableInferenceAdapter,
    type ModelClass,
    type ModelProviderName,
    ServiceType,
    type TelemetrySettings,
    type VerifiableInferenceOptions,
    type VerifiableInferenceResult
} from "./types.ts";

// ================ TYPE DEFINITIONS ================
type Tool = CoreTool<any, any>;
type StepResult = AIStepResult<any>;

interface TogetherAIImageResponse {
    data: Array<{
        url: string;
        content_type?: string;
        image_type?: string;
    }>;
}

interface ModelSettings {
    prompt: string;
    temperature: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop?: string[];
    experimental_telemetry?: TelemetrySettings;
}

interface GenerationOptions {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    stop?: string[];
    mode?: "auto" | "json" | "tool";
    output?: "object" | "array" | "enum" | "no-schema" | undefined;
    enum?: string[];
    experimental_providerMetadata?: Record<string, unknown>;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}

// ================ UTILITY FUNCTIONS ================
function getCloudflareGatewayBaseURL(
    runtime: IAgentRuntime,
    provider: string
): string | undefined {
    const isCloudflareEnabled = runtime.getSetting("CLOUDFLARE_GW_ENABLED") === "true";
    const cloudflareAccountId = runtime.getSetting("CLOUDFLARE_AI_ACCOUNT_ID");
    const cloudflareGatewayId = runtime.getSetting("CLOUDFLARE_AI_GATEWAY_ID");

    elizaLogger.debug("Cloudflare Gateway Configuration:", {
        isEnabled: isCloudflareEnabled,
        hasAccountId: !!cloudflareAccountId,
        hasGatewayId: !!cloudflareGatewayId,
        provider: provider,
    });

    if (!isCloudflareEnabled) {
        elizaLogger.debug("Cloudflare Gateway is not enabled");
        return undefined;
    }

    if (!cloudflareAccountId) {
        elizaLogger.warn("Cloudflare Gateway is enabled but CLOUDFLARE_AI_ACCOUNT_ID is not set");
        return undefined;
    }

    if (!cloudflareGatewayId) {
        elizaLogger.warn("Cloudflare Gateway is enabled but CLOUDFLARE_AI_GATEWAY_ID is not set");
        return undefined;
    }

    const baseURL = `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/${provider.toLowerCase()}`;
    elizaLogger.info("Using Cloudflare Gateway:", {
        provider,
        baseURL,
        accountId: cloudflareAccountId,
        gatewayId: cloudflareGatewayId,
    });

    return baseURL;
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

// ================ TEXT GENERATION FUNCTIONS ================
export async function generateText({
    runtime,
    context,
    modelClass,
    tools = {},
    onStepFinish,
    maxSteps = 1,
    stop,
    verifiableInference = process.env.VERIFIABLE_INFERENCE_ENABLED === "true",
    verifiableInferenceOptions,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    tools?: Record<string, Tool>;
    onStepFinish?: (event: StepResult) => Promise<void> | void;
    maxSteps?: number;
    stop?: string[];
    customSystemPrompt?: string;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}): Promise<string> {
    logFunctionCall('generateText', runtime);
    if (!context) {
        console.error("generateText context is empty");
        return "";
    }

    elizaLogger.log("Generating text...");

    elizaLogger.info("Generating text with options:", {
        modelProvider: runtime.modelProvider,
        model: modelClass,
        verifiableInference,
    });
    elizaLogger.log("Using provider:", runtime.modelProvider);
    // If verifiable inference is requested and adapter is provided, use it
    if (verifiableInference && runtime.verifiableInferenceAdapter) {
        elizaLogger.log(
            "Using verifiable inference adapter:",
            runtime.verifiableInferenceAdapter
        );
        try {
            const result: VerifiableInferenceResult =
                await runtime.verifiableInferenceAdapter.generateText(
                    context,
                    modelClass,
                    verifiableInferenceOptions
                );
            elizaLogger.log("Verifiable inference result:", result);
            // Verify the proof
            const isValid =
                await runtime.verifiableInferenceAdapter.verifyProof(result);
            if (!isValid) {
                throw new Error("Failed to verify inference proof");
            }

            return result.text;
        } catch (error) {
            elizaLogger.error("Error in verifiable inference:", error);
            throw error;
        }
    }

    const provider = runtime.modelProvider;
    elizaLogger.debug("Provider settings:", {
        provider,
        hasRuntime: !!runtime,
        runtimeSettings: {
            CLOUDFLARE_GW_ENABLED: runtime.getSetting("CLOUDFLARE_GW_ENABLED"),
            CLOUDFLARE_AI_ACCOUNT_ID: runtime.getSetting(
                "CLOUDFLARE_AI_ACCOUNT_ID"
            ),
            CLOUDFLARE_AI_GATEWAY_ID: runtime.getSetting(
                "CLOUDFLARE_AI_GATEWAY_ID"
            ),
        },
    });

    const endpoint =
        runtime.character.modelEndpointOverride || runtime.getSetting("MODEL_ENDPOINT");

    // test: make it work without modelSettings
    // const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
    const model = runtime.getModelProvider().defaultModel;

    // allow character.json settings => secrets to override models
    // FIXME: Add MODEL_MEDIUM and other model class support
    

    elizaLogger.info("Selected model:", model);

    const apiKey = runtime.token;

    try {


        // elizaLogger.debug(
        //     `Trimming context to max length of ${max_context_length} tokens.`
        // );

        // context = await trimTokens(context, max_context_length, runtime);

        // const _stop = stop || modelSettings.stop;
        // elizaLogger.debug(
        //     `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
        // );

        logFunctionCall('generateText', runtime);

        
        elizaLogger.debug(`Initializing ${model} model.`);
        const serverUrl = endpoint;
        const createOpenAICompabitbleModel = createOpenAI({
            apiKey,
            baseURL: serverUrl,
            fetch: runtime.fetch,
        });

        const { text } = await aiGenerateText({
            model: createOpenAICompabitbleModel.languageModel(model),
            prompt: context,
            system:
                runtime.character.system ??
                settings.SYSTEM_PROMPT ??
                undefined,
            tools: tools,
            onStepFinish: onStepFinish,
            maxSteps: maxSteps,
        });

        elizaLogger.debug(`Received response from ${model} model.`);
        
        return text;    
    } catch (error) {
        elizaLogger.error("Error in generateText:", error);
        throw error;
    }
}



export async function generateTextArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<string[]> {
    logFunctionCall('generateTextArray', runtime);
    if (!context) {
        elizaLogger.error("generateTextArray context is empty");
        return [];
    }
    let retryDelay = 1000;

    while (true) {
        try {
            const response = await generateObject({
                runtime,
                context,
                modelClass,
                output: "array",
            });

            const parsedResponse = parseJsonArrayFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTextArray:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateShouldRespond({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
    logFunctionCall('generateShouldRespond', runtime);
    let retryDelay = 1000;
    while (true) {
        try {
            elizaLogger.debug(
                "Attempting to generate text with context:",
                context
            );
            const {object} = await generateObject({
                runtime,
                context,
                modelClass,
                output: 'enum',
                enum: ['RESPOND', 'IGNORE', 'STOP'],
                schema: z.enum(['RESPOND', 'IGNORE', 'STOP']),
            });

            elizaLogger.debug("Received response from generateObject:", object);
            
            return object;

        } catch (error) {
            elizaLogger.error("Error in generateShouldRespond:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }

        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateTrueOrFalse({
    runtime,
    context = "",
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<boolean> {
    logFunctionCall('generateTrueOrFalse', runtime);
    // generate based on enum using generateObject
    const response = await generateObject({
        runtime,
        context,
        modelClass,
        output: 'enum',
        enum: ['true', 'false'],
        schema: z.enum(['true', 'false']),
    });

    if (response.object === 'true') {
        return true;
    } 
    if (response.object === 'false') {
        return false;
    }
    throw new Error('Invalid response from model');
}



// ================ OBJECT GENERATION FUNCTIONS ================
export const generateObject = async ({
    runtime,
    context,
    output,
    modelClass,
    schema,
    schemaName,
    schemaDescription,
    stop,
    mode = "json",
    verifiableInference,
    verifiableInferenceAdapter,
    verifiableInferenceOptions,
}: GenerationOptions): Promise<GenerateObjectResult<unknown>> => {
    logFunctionCall('generateObject', runtime);
    if (!context) {
        const errorMessage = "generateObject context is empty";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }


    elizaLogger.debug(`Generating object with ${runtime.modelProvider} model. for ${schemaName}`);
        const serverUrl = runtime.getModelProvider().endpoint;
        const apiKey = runtime.token;
        const model = runtime.getModelProvider().defaultModel;
        
        const createOpenAICompabitbleModel = createOpenAI({
            apiKey,
            baseURL: serverUrl,
            fetch: runtime.fetch,
        });

        const result = await aiGenerateObject({
            model: createOpenAICompabitbleModel.languageModel(model),
            prompt: context.toString(),
            schema,
            schemaName,
            schemaDescription,
            output,
            system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
            stop
        });

        elizaLogger.debug(`Received Object response from ${model} model.`);
        
        return result.object;
};

export async function generateObjectDeprecated({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<GenerateObjectResult> {
    logFunctionCall('generateObjectDeprecated', runtime);
    return generateObject({
        runtime,
        context,
        modelClass,
    });
}

export async function generateObjectArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<Array<any>> {
    logFunctionCall('generateObjectArray', runtime);
    if (!context) {
        elizaLogger.error("generateObjectArray context is empty");
        return [];
    }
    const {object } = await generateObject({
        runtime,
        context,
        modelClass,
        output: "array",
    });
    return object;
}


export async function generateMessageResponse({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<Content> {
    logFunctionCall('generateMessageResponse', runtime);
    // const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
    // const max_context_length = modelSettings.maxInputTokens;

    // context = await trimTokens(context, max_context_length, runtime);
    elizaLogger.debug("Context:", context);
    let retryLength = 1000; // exponential backoff
    while (true) {
        try {
            elizaLogger.log("Generating message response..");

            const response = await aiGenerateText({
                runtime,
                context,
                modelClass,
            });

            // try parsing the response as JSON, if null then try again
            const parsedContent = parseJSONObjectFromText(response) as Content;
            if (!parsedContent) {
                elizaLogger.debug("parsedContent is null, retrying");
                continue;
            }

            return parsedContent;
        } catch (error) {
            elizaLogger.error("ERROR:", error);
            // wait for 2 seconds
            retryLength *= 2;
            await new Promise((resolve) => setTimeout(resolve, retryLength));
            elizaLogger.debug("Retrying...");
        }
    }
}


// ================ IMAGE-RELATED FUNCTIONS ================
export const generateImage = async (
    data: {
        prompt: string;
        width: number;
        height: number;
        count?: number;
        negativePrompt?: string;
        numIterations?: number;
        guidanceScale?: number;
        seed?: number;
        modelId?: string;
        jobId?: string;
        stylePreset?: string;
        hideWatermark?: boolean;
        safeMode?: boolean;
        cfgScale?: number;
    },
    runtime: IAgentRuntime
): Promise<{
    success: boolean;
    data?: string[];
    error?: any;
}> => {
    logFunctionCall('generateImage', runtime);
    const modelSettings = runtime.imageModelProvider;

    if (!modelSettings) {
        elizaLogger.warn("No model settings found for the image model provider.");
        return { success: false, error: "No model settings available" };
    }
    const model = runtime.getModelProvider().imageModel;
    elizaLogger.info("Generating image with options:", {
        imageModelProvider: model,
    });

    const apiKey = runtime.getModelProvider().apiKey;
    try{
        // GENERATE IMAGES USING VERCEL AI SDK

        const result = await aiGenerateImage({
            provider: runtime.imageModelProvider,
            model: model,
            apiKey: apiKey,
            prompt: data.prompt,
            width: data.width,
            height: data.height,
            count: data.count,
            negativePrompt: data.negativePrompt,
            numIterations: data.numIterations,
            guidanceScale: data.guidanceScale,
            seed: data.seed,
            modelId: data.modelId,
            jobId: data.jobId,
        });
        return result;
        
    } catch (_error) {
        elizaLogger.error("Error in generateImage:", error);
        return { success: false, error: _error };
    }
};


export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{
    title: string;
    description: string;
}> => {
    logFunctionCall('generateCaption', runtime);
    const { imageUrl } = data;
    const imageDescriptionService =
        runtime.getService<IImageDescriptionService>(
            ServiceType.IMAGE_DESCRIPTION
        );

    if (!imageDescriptionService) {
        throw new Error("Image description service not found");
    }

    const resp = await imageDescriptionService.describeImage(imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};









