// ================ IMPORTS ================
import { z, type ZodSchema } from "zod";
import { logger } from "./index.ts";
import { parseJSONObjectFromText } from "./parsing.ts";
import {
    type Content,
    type IAgentRuntime,
    ModelClass
} from "./types.ts";

// ================ INTERFACES ================
interface GenerateObjectOptions {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  output?: "object" | "array" | "enum" | "no-schema" | undefined;
  schema?: ZodSchema;
  schemaName?: string;
  schemaDescription?: string;
  mode?: "auto" | "json" | "tool";
  enumValues?: Array<string>;  // Changed from 'enum' to 'enumValues'
  stopSequences?: string[];
}

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

// ================ COMMON UTILITIES ================
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

/**
 * Trims the provided text context to a specified token limit using a tokenizer model and type.
 */
export async function trimTokens(
  context: string,
  maxTokens: number,
  runtime: IAgentRuntime
) {
  if (!context) throw new Error("Trim tokens received a null context");
  
  // if context is less than of maxtokens / 5, skip
  if (context.length < (maxTokens / 5)) return context;

  if (maxTokens <= 0) throw new Error("maxTokens must be positive");

  try {
      const tokens = await runtime.useModel(ModelClass.TEXT_TOKENIZER_ENCODE, { context });

      // If already within limits, return unchanged
      if (tokens.length <= maxTokens) {
          return context;
      }

      // Keep the most recent tokens by slicing from the end
      const truncatedTokens = tokens.slice(-maxTokens);

      // Decode back to text
      return await runtime.useModel(ModelClass.TEXT_TOKENIZER_DECODE, { tokens: truncatedTokens });
  } catch (error) {
      logger.error("Error in trimTokens:", error);
      // Return truncated string if tokenization fails
      return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
  }
}

// ================ TEXT GENERATION FUNCTIONS ================
export async function generateText({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  stopSequences = [],
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  stopSequences?: string[];
  customSystemPrompt?: string;
}): Promise<string> {
  const text = await runtime.useModel(modelClass, {
    runtime,
    context,
    stopSequences,
  });

  return text;
}

export async function generateTextArray({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  stopSequences?: string[];
}): Promise<string[]> {
  const result = await withRetry(async () => {
    const response = await generateObject({
      runtime,
      context,
      modelClass,
      output: "array",
      schema: z.array(z.string()),
      stopSequences,
    });
    logger.debug("Received response from generateObject:", response);
    return response;
  });

  return Array.isArray(result) ? result : [];
}

// ================ OBJECT GENERATION FUNCTIONS ================
export const generateObject = async ({
  runtime,
  context,
  modelClass = ModelClass.TEXT_LARGE,
  stopSequences,
  output = "object",
  enumValues,
  schema,
  mode,
}: GenerateObjectOptions): Promise<any> => {
  if (!context) {
    const errorMessage = "generateObject context is empty";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Special handling for enum output type
  if (output === "enum" && enumValues) {
    const response = await runtime.useModel(modelClass, {
      runtime,
      context,
      modelClass,
      stopSequences,
      maxTokens: 8,
      object: true,
    });

    // Clean up the response to extract just the enum value
    const cleanedResponse = response.trim();
    
    // Verify the response is one of the allowed enum values
    if (enumValues.includes(cleanedResponse)) {
      return cleanedResponse;
    }
    
    // If the response includes one of the enum values (case insensitive)
    const matchedValue = enumValues.find(value => 
      cleanedResponse.toLowerCase().includes(value.toLowerCase())
    );
    
    if (matchedValue) {
      return matchedValue;
    }

    logger.error(`Invalid enum value received: ${cleanedResponse}`);
    logger.error(`Expected one of: ${enumValues.join(", ")}`);
    return null;
  }

  // Regular object/array generation
  const response = await runtime.useModel(modelClass, {
    runtime,
    context,
    modelClass,
    stopSequences,
    object: true,
  });

  let jsonString = response;

  // Find appropriate brackets based on expected output type
  const firstChar = output === "array" ? "[" : "{";
  const lastChar = output === "array" ? "]" : "}";
  
  const firstBracket = response.indexOf(firstChar);
  const lastBracket = response.lastIndexOf(lastChar);
  
  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    jsonString = response.slice(firstBracket, lastBracket + 1);
  }

  if (jsonString.length === 0) {
    logger.error(`Failed to extract JSON ${output} from model response`);
    return null;
  }

  // Parse the JSON string
  try {
    const json = JSON.parse(jsonString);
    
    // Validate against schema if provided
    if (schema) {
      return schema.parse(json);
    }
    
    return json;
  } catch (error) {
    logger.error(`Failed to parse JSON ${output}`);
    logger.error(jsonString);
    return null;
  }
};

export async function generateObjectArray({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  schema,
  schemaName,
  schemaDescription,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  schema?: ZodSchema;
  schemaName?: string;
  schemaDescription?: string;
}): Promise<z.infer<typeof schema>[]> {
  if (!context) {
    logger.error("generateObjectArray context is empty");
    return [];
  }
  
  const result = await generateObject({
    runtime,
    context,
    modelClass,
    output: "array",
    schema,
    schemaName,
    schemaDescription,
    mode: "json",
  });
  
  if (!Array.isArray(result)) {
    logger.error("Generated result is not an array");
    return [];
  }
  
  return schema ? schema.parse(result) : result;
}

// ================ ENUM GENERATION FUNCTIONS ================
async function generateEnum<T extends string>({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  enumValues,
  stopSequences = ["\\n"],
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  enumValues: Array<T>;
  stopSequences?: string[];
}): Promise<T | null> {
  const enumResult = await withRetry(async () => {
    logger.debug(
      "Attempting to generate enum value with context:",
      context
    );
    const result = await generateObject({
      runtime,
      context,
      modelClass,
      output: "enum",
      enumValues,
      mode: "json",
      stopSequences,
    });

    logger.debug("Received enum response:", result);
    return result;
  });

  return enumResult as T | null;
}

export async function generateTrueOrFalse({
  runtime,
  context = "",
  modelClass = ModelClass.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  stopSequences?: string[];
}): Promise<boolean> {
  const response = await runtime.useModel(modelClass, {
    runtime,
    context,
    stopSequences,
  });

  const cleanedResponse = response.trim().toLowerCase();
  
  // Handle various affirmative responses
  if (cleanedResponse === "true" || 
      cleanedResponse === "yes" || 
      cleanedResponse === "y" ||
      cleanedResponse.includes("true") ||
      cleanedResponse.includes("yes")) {
    return true;
  }
  
  // Handle various negative responses
  if (cleanedResponse === "false" || 
      cleanedResponse === "no" || 
      cleanedResponse === "n" ||
      cleanedResponse.includes("false") ||
      cleanedResponse.includes("no")) {
    return false;
  }

  // Default to false if response is unclear
  logger.warn(`Unclear boolean response: ${response}, defaulting to false`);
  return false;
}

export async function generateShouldRespond({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  stopSequences = ["\\n"],
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  stopSequences?: string[];
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
  const RESPONSE_VALUES = ["RESPOND", "IGNORE", "STOP"];
  
  const result = await generateEnum({
    runtime,
    context,
    modelClass,
    enumValues: RESPONSE_VALUES,
    stopSequences,
  });

  return result as "RESPOND" | "IGNORE" | "STOP" | null;
}

export async function generateMessageResponse({
  runtime,
  context,
  modelClass = ModelClass.TEXT_SMALL,
  stopSequences,
}: {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  stopSequences?: string[];
}): Promise<Content> {
  return await withRetry(async () => {
    const text = await runtime.useModel(modelClass, {
      runtime,
      context,
      stop: stopSequences,
    });

    const parsedContent = parseJSONObjectFromText(text) as Content;

    if (!parsedContent) {
      throw new Error("Failed to parse content");
    }

    return parsedContent;
  });
}