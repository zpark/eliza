// ================ IMPORTS ================
import { z, type ZodSchema } from "zod";
import { logFunctionCall, logger } from "./index.ts";
import { parseJSONObjectFromText } from "./parsing.ts";
import {
    type Content,
    type IAgentRuntime,
    ModelType
} from "./types.ts";

interface GenerateObjectOptions {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  output?: "object" | "array" | "enum" | "no-schema" | undefined;
  schema?: ZodSchema;
  schemaName?: string;
  schemaDescription?: string;
  mode?: "auto" | "json" | "tool";
  enum?: Array<string>;
  stopSequences?: string[];
}

// ================ COMMON UTILITIES ================
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 8000,
    shouldRetry = (error: any) =>
      !(error instanceof TypeError || error instanceof SyntaxError),
  } = options;

  let retryCount = 0;
  let retryDelay = initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      retryCount++;
      logger.error(
        `Operation failed (attempt ${retryCount}/${maxRetries}):`,
        error
      );

      if (!shouldRetry(error) || retryCount >= maxRetries) {
        throw error;
      }

      retryDelay = Math.min(retryDelay * 2, maxDelay);
      logger.debug(`Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

// ================ TEXT GENERATION FUNCTIONS ================
export async function generateText({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  stopSequences?: string[];
  customSystemPrompt?: string;
}): Promise<string> {
  logFunctionCall("generateText", runtime);

  const { text } = await runtime.call(modelType, {
    context,
    stopSequences,
  });

  return text;
}

export async function generateTextArray({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  stopSequences?: string[];
}): Promise<string[]> {
  logFunctionCall("generateTextArray", runtime);

  const result = await withRetry(async () => {
    const result = await generateObject({
      runtime,
      context,
      modelType,
      schema: z.array(z.string()),
      stopSequences,
    });
    logger.debug("Received response from generateObject:", result);
  });

  return Array.isArray(result) ? result : [];
}

// ================ ENUM GENERATION FUNCTIONS ================
async function generateEnum<T extends string>({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  enumValues,
  functionName,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  enumValues: Array<T>;
  functionName: string;
  stopSequences?: string[];
}): Promise<any> {
  logFunctionCall(functionName, runtime);

  const enumResult = await withRetry(async () => {
    logger.debug(
      "Attempting to generate enum value with context:",
      context
    );
    const result = await generateObject({
      runtime,
      context,
      modelType,
      output: "enum",
      enum: enumValues,
      mode: "json",
      stopSequences: stopSequences,
    });

    logger.debug("Received enum response:", result);
    return result;
  });

  return enumResult;
}

export async function generateShouldRespond({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  stopSequences?: string[];
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
  const RESPONSE_VALUES = ["RESPOND", "IGNORE", "STOP"] as string[];

  const result = await generateEnum({
    runtime,
    context,
    modelType,
    enumValues: RESPONSE_VALUES,
    functionName: "generateShouldRespond",
    stopSequences,
  });

  return result as "RESPOND" | "IGNORE" | "STOP";
}

export async function generateTrueOrFalse({
  runtime,
  context = "",
  modelType = ModelType.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  stopSequences?: string[];
}): Promise<boolean> {
  logFunctionCall("generateTrueOrFalse", runtime);

  const BOOL_VALUES = ["true", "false"];

  const result = await generateEnum({
    runtime,
    context,
    modelType,
    enumValues: BOOL_VALUES,
    functionName: "generateTrueOrFalse",
    stopSequences,
  });

  return result === "true";
}

// ================ OBJECT GENERATION FUNCTIONS ================
export const generateObject = async ({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  output = "object",
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  enum: enumValues,
  stopSequences,
}: GenerateObjectOptions): Promise<z.infer<typeof schema> | any> => {
  logFunctionCall("generateObject", runtime);
  if (!context) {
    const errorMessage = "generateObject context is empty";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const { object } = await runtime.call(modelType, {
    context,
    stop: stopSequences,
  });

  logger.debug(`Received Object response from ${modelType} model.`);
  return schema ? schema.parse(object) : object;
};

export async function generateObjectArray({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  schema,
  schemaName,
  schemaDescription,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  schema?: ZodSchema;
  schemaName?: string;
  schemaDescription?: string;
}): Promise<z.infer<typeof schema>[]> {
  logFunctionCall("generateObjectArray", runtime);
  if (!context) {
    logger.error("generateObjectArray context is empty");
    return [];
  }
  const result = await generateObject({
    runtime,
    context,
    modelType,
    output: "array",
    schema,
    schemaName,
    schemaDescription,
    mode: "json",
  });
  return schema ? schema.parse(result) : result;
}

export async function generateMessageResponse({
  runtime,
  context,
  modelType = ModelType.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelType: ModelType;
  stopSequences?: string[];
}): Promise<Content> {
  logFunctionCall("generateMessageResponse", runtime);

  logger.debug("Context:", context);

  return await withRetry(async () => {
    const { text } = await runtime.call(modelType, {
      context,
      stop: stopSequences,
    });

    logger.info("Text:", text);

    const parsedContent = parseJSONObjectFromText(text) as Content;
    logger.info("Parsed content:", parsedContent);

    if (!parsedContent) {
      throw new Error("Failed to parse content");
    }

    return parsedContent;
  });
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
  logFunctionCall("generateImage", runtime);

  return await withRetry(
    async () => {
      const result = await runtime.call(ModelType.IMAGE, data);
      return {
        success: true,
        data: result.images,
        error: undefined,
      };
    },
    {
      maxRetries: 2,
      initialDelay: 2000,
    }
  );
};

export const generateCaption = async (
  data: { imageUrl: string },
  runtime: IAgentRuntime
): Promise<{
  title: string;
  description: string;
}> => {
  logFunctionCall("generateCaption", runtime);
  const { imageUrl } = data;
  const resp = await runtime.call(ModelType.IMAGE_DESCRIPTION, imageUrl);

  return {
    title: resp.title.trim(),
    description: resp.description.trim(),
  };
};