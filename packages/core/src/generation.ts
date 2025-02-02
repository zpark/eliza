import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import {
    generateText as aiGenerateText,
    generateObject as aiGenerateObject,
    generateImage as aiGenerateImage,
    type StepResult as AIStepResult,
    type CoreTool,
    type GenerateTextOptions,
    type GenerateObjectOptions,
    type GenerateImageOptions,
    type GenerateObjectResult,
    type GenerateImageResult,
    type GenerateTextResult,
} from "ai";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Buffer } from "node:buffer";
import { object, type ZodSchema } from "zod";
import { elizaLogger, logFunctionCall } from "./index.ts";
import {
    parseActionResponseFromText,
    parseBooleanFromText,
    parseJsonArrayFromText,
    parseJSONObjectFromText,
    parseShouldRespondFromText,
} from "./parsing.ts";
import settings from "./settings.ts";
import {
    type ActionResponse,
    type Content,
    type IAgentRuntime,
    type IImageDescriptionService,
    type IVerifiableInferenceAdapter,
    type ModelClass,
    type ModelProviderName,
    ServiceType,
    //VerifiableInferenceProvider,
    type TelemetrySettings,
    TokenizerType,
    type VerifiableInferenceOptions,
    type VerifiableInferenceResult
} from "./types.ts";

import BigNumber from "bignumber.js";
import { createPublicClient, http } from "viem";

type Tool = CoreTool<any, any>;
type StepResult = AIStepResult<any>;


function getCloudflareGatewayBaseURL(
    runtime: IAgentRuntime,
    provider: string
): string | undefined {
    const isCloudflareEnabled =
        runtime.getSetting("CLOUDFLARE_GW_ENABLED") === "true";
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
        elizaLogger.warn(
            "Cloudflare Gateway is enabled but CLOUDFLARE_AI_ACCOUNT_ID is not set"
        );
        return undefined;
    }

    if (!cloudflareGatewayId) {
        elizaLogger.warn(
            "Cloudflare Gateway is enabled but CLOUDFLARE_AI_GATEWAY_ID is not set"
        );
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

/**
 * Send a message to the model for a text generateText - receive a string back and parse how you'd like
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */

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
    let model = runtime.getModelProvider().defaultModel;

    // allow character.json settings => secrets to override models
    // FIXME: Add MODEL_MEDIUM and other model class support
    

    elizaLogger.info("Selected model:", model);

    // TODO: add model settings
    // TODO: handle Model Settings
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
            // temperature: temperature,
            system:
                runtime.character.system ??
                settings.SYSTEM_PROMPT ??
                undefined,
            tools: tools,
            onStepFinish: onStepFinish,
            maxSteps: maxSteps,
            // maxTokens: max_response_length,
            // frequencyPenalty: frequency_penalty,
            // presencePenalty: presence_penalty,
            // experimental_telemetry: experimental_telemetry,
        });

        elizaLogger.debug(`Received response from ${model} model.`);
        
        return text;    
    } catch (error) {
        elizaLogger.error("Error in generateText:", error);
        throw error;
    }
}


// ## DO NOT TOUCH, THIS FUNCTION IS FINE

/**
 * Sends a message to the model to determine if it should respond to the given context.
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to "RESPOND", "IGNORE", "STOP" or null
 */
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
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            elizaLogger.debug("Received response from generateText:", response);
            const parsedResponse = parseShouldRespondFromText(response.trim());
            if (parsedResponse) {
                elizaLogger.debug("Parsed response:", parsedResponse);
                return parsedResponse;
            }
                elizaLogger.debug("generateShouldRespond no response");
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


// ## DO NOT TOUCH, THIS FUNCTION IS FINE

/**
 * Splits content into chunks of specified size with optional overlapping bleed sections
 * @param content - The text content to split into chunks
 * @param chunkSize - The maximum size of each chunk in tokens
 * @param bleed - Number of characters to overlap between chunks (default: 100)
 * @returns Promise resolving to array of text chunks with bleed sections
 */
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
        averageChunkSize:
            chunks.reduce((acc, chunk) => acc + chunk.length, 0) /
            chunks.length,
    });

    return chunks;
}





/**
 * Sends a message to the model and parses the response as a boolean value
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for the boolean response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to a boolean value parsed from the model's response
 */
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


// ## DO NOT TOUCH, THIS FUNCTION IS FINE

/**
 * Send a message to the model and parse the response as a string array
 * @param opts - The options for the generateText request
 * @param opts.context The context/prompt to send to the model
 * @param opts.stop Array of strings that will stop the model's generation if encountered
 * @param opts.model The language model to use
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to an array of strings parsed from the model's response
 */
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
            const response = await generateText({
                runtime,
                context,
                modelClass,
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


// ## DO NOT TOUCH, THIS FUNCTION IS FINE

// make it a pass through to generateObject 
export async function generateObjectDeprecated({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<any> {
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
}): Promise<any[]> {
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

/**
 * Send a message to the model for generateText.
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
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

            const response = await generateText({
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


// TODO: FIX THIS FUNCTION

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

/**
 * Configuration options for generating objects with a model.
 */
export interface GenerationOptions {
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

/**
 * Base settings for model generation.
 */
interface ModelSettings {
    prompt: string;
    temperature: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop?: string[];
    experimental_telemetry?: TelemetrySettings;
}

/**
 * Generates structured objects from a prompt using specified AI models and configuration options.
 *
 * @param {GenerationOptions} options - Configuration options for generating objects.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 * @throws {Error} - Throws an error if the provider is unsupported or if generation fails.
 */
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

/**
 * Interface for provider-specific generation options.
 */
interface ProviderOptions {
    runtime: IAgentRuntime;
    provider: ModelProviderName;
    model: any;
    apiKey: string;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
    modelOptions: ModelSettings;
    modelClass: ModelClass;
    context: string;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}


// Add type definition for Together AI response
interface TogetherAIImageResponse {
    data: Array<{
        url: string;
        content_type?: string;
        image_type?: string;
    }>;
}


// THIS SHOULD BE IN TWITTER CLIENT PACKAGE
// export async function generateTweetActions({
//     runtime,
//     context,
//     modelClass,
// }: {
//     runtime: IAgentRuntime;
//     context: string;
//     modelClass: ModelClass;
// }): Promise<ActionResponse | null> {
//     logFunctionCall('generateTweetActions', runtime);
//     let retryDelay = 1000;
//     while (true) {
//         try {
//             const response = await generateText({
//                 runtime,
//                 context,
//                 modelClass,
//             });
//             elizaLogger.debug(
//                 "Received response from generateText for tweet actions:",
//                 response
//             );
//             const { actions } = parseActionResponseFromText(response.trim());
//             if (actions) {
//                 elizaLogger.debug("Parsed tweet actions:", actions);
//                 return actions;
//             }
//                 elizaLogger.debug("generateTweetActions no valid response");
//         } catch (error) {
//             elizaLogger.error("Error in generateTweetActions:", error);
//             if (
//                 error instanceof TypeError &&
//                 error.message.includes("queueTextCompletion")
//             ) {
//                 elizaLogger.error(
//                     "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
//                 );
//             }
//         }
//         elizaLogger.log(`Retrying in ${retryDelay}ms...`);
//         await new Promise((resolve) => setTimeout(resolve, retryDelay));
//         retryDelay *= 2;
//     }
// }

//             schema,
//             schemaName,
//             schemaDescription,
//             output: output ?? "object",
//             system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//         });

//         elizaLogger.debug(`Received Object response from ${model} model.`);
        
//         return result.object;
// };

/**
 * Interface for provider-specific generation options.
 */
interface ProviderOptions {
    runtime: IAgentRuntime;
    provider: ModelProviderName;
    model: any;
    apiKey: string;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
    modelOptions: ModelSettings;
    modelClass: ModelClass;
    context: string;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}



