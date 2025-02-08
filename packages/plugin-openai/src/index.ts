import { createOpenAI } from "@ai-sdk/openai";
import type { Plugin } from "@elizaos/core";
import {
  DetokenizeTextParams,
  GenerateTextParams,
  ModelType,
  TokenizeTextParams,
} from "@elizaos/core";
import { generateText as aiGenerateText } from "ai";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";
import { z } from "zod";

async function tokenizeText(model: ModelType, context: string) {
  const modelName =
    model === ModelType.TEXT_SMALL
      ? process.env.OPENAI_SMALL_MODEL ??
        process.env.SMALL_MODEL ??
        "gpt-4o-mini"
      : process.env.LARGE_MODEL ?? "gpt-4o";
  const encoding = encodingForModel(modelName as TiktokenModel);
  const tokens = encoding.encode(context);
  return tokens;
}

async function detokenizeText(model: ModelType, tokens: number[]) {
  const modelName =
    model === ModelType.TEXT_SMALL
      ? process.env.OPENAI_SMALL_MODEL ??
        process.env.SMALL_MODEL ??
        "gpt-4o-mini"
      : process.env.OPENAI_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";
  const encoding = encodingForModel(modelName as TiktokenModel);
  return encoding.decode(tokens);
}

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_SMALL_MODEL: z.string().optional(),
  OPENAI_LARGE_MODEL: z.string().optional(),
  SMALL_MODEL: z.string().optional(),
  LARGE_MODEL: z.string().optional(),
});

export const openaiPlugin: Plugin = {
  name: "openai",
  description: "OpenAI plugin",
  async init(config: Record<string, string>) {
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      Object.entries(validatedConfig).forEach(([key, value]) => {
        if (value) process.env[key] = value;
      });

      // Verify API key
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      const response = await fetch(`${baseURL}/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to validate OpenAI API key: ${response.statusText}`
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors
            .map((e) => e.message)
            .join(", ")}`
        );
      }
      throw error;
    }
  },
  handlers: {
    [ModelType.TEXT_EMBEDDING]: async (text: string | null) => {
      if (!text) {
        // Return zero vector of appropriate length for model
        return new Array(1536).fill(0);
      }

      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

      // use fetch to call embedding endpoint
      const response = await fetch(`${baseURL}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      });

      const data = await response.json();
      return data.data[0].embedding;
    },
    [ModelType.TEXT_TOKENIZER_ENCODE]: async ({
      context,
      modelType,
    }: TokenizeTextParams) => {
      return tokenizeText(modelType ?? ModelType.TEXT_LARGE, context);
    },
    [ModelType.TEXT_TOKENIZER_DECODE]: async ({
      tokens,
      modelType,
    }: DetokenizeTextParams) => {
      return detokenizeText(modelType ?? ModelType.TEXT_LARGE, tokens);
    },
    [ModelType.TEXT_SMALL]: async ({
      runtime,
      context,
      stopSequences = [],
    }: GenerateTextParams) => {
      const temperature = 0.7;
      const frequency_penalty = 0.7;
      const presence_penalty = 0.7;
      const max_response_length = 8192;

      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL,
      });

      const model =
        process.env.OPENAI_SMALL_MODEL ??
        process.env.SMALL_MODEL ??
        "gpt-4o-mini";

      const { text: openaiResponse } = await aiGenerateText({
        model: openai.languageModel(model),
        prompt: context,
        system: runtime.character.system ?? undefined,
        temperature: temperature,
        maxTokens: max_response_length,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stopSequences: stopSequences,
      });

      return openaiResponse;
    },
    [ModelType.TEXT_LARGE]: async ({
      runtime,
      context,
      stopSequences = [],
    }: GenerateTextParams) => {
      const temperature = 0.7;
      const frequency_penalty = 0.7;
      const presence_penalty = 0.7;
      const max_response_length = 8192;

      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL,
      });

      const smallModel =
        process.env.OPENAI_SMALL_MODEL ??
        process.env.SMALL_MODEL ??
        "gpt-4o-mini";
      const model =
        process.env.OPENAI_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";

      const { text: openaiResponse } = await aiGenerateText({
        model: openai.languageModel(model),
        prompt: context,
        system: runtime.character.system ?? undefined,
        temperature: temperature,
        maxTokens: max_response_length,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stopSequences: stopSequences,
      });

      return openaiResponse;
    },
    [ModelType.IMAGE]: async (params: {
      prompt: string;
      n?: number;
      size?: string;
    }) => {
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      const response = await fetch(`${baseURL}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.statusText}`);
      }
      const data = await response.json();
      return data.data; // Typically an array of image URLs/data
    },
    [ModelType.IMAGE_DESCRIPTION]: async (params: { imageUrl: string }) => {
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL,
      });
      const prompt = `Provide a detailed description of the image found at this URL: ${params.imageUrl}`;
      const { text: description } = await aiGenerateText({
        model: openai.languageModel(
          process.env.OPENAI_SMALL_MODEL ?? "gpt-4o-mini"
        ),
        prompt,
        temperature: 0.7,
        maxTokens: 256,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stopSequences: [],
      });
      return description;
    },
    [ModelType.TRANSCRIPTION]: async (params: {
      audioFile: any;
      language?: string;
    }) => {
      const baseURL =
        process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      const formData = new FormData();
      formData.append("file", params.audioFile);
      formData.append("model", "whisper-1");
      if (params.language) {
        formData.append("language", params.language);
      }
      const response = await fetch(`${baseURL}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          // Note: Do not set a Content-Type header—letting fetch set it for FormData is best
        },
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.statusText}`);
      }
      const data = await response.json();
      return data.text;
    },
  },
};
export default openaiPlugin;
