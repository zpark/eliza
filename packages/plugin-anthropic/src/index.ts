import { anthropic } from "@ai-sdk/anthropic";
import type { Plugin } from "@elizaos/core";
import {
  type GenerateTextParams,
  ModelClass
} from "@elizaos/core";
import { generateText } from "ai";
import { z } from "zod";
import { EmbeddingModel, FlagEmbedding } from "fastembed";

// Define a configuration schema for the Anthropics plugin.
const configSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "Anthropic API key is required"),
  ANTHROPIC_SMALL_MODEL: z.string().optional(),
  ANTHROPIC_LARGE_MODEL: z.string().optional(),
});

export const anthropicPlugin: Plugin = {
  name: "anthropic",
  description: "Anthropic plugin (supports text generation only)",
  async init(config: Record<string, string>) {
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
      
      // (Optional) If the Anthropics SDK supports API key verification,
      // you might add a check here.
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
  models: {
    [ModelClass.TEXT_SMALL]: async (
      runtime,
      {
      context,
      stopSequences = [],
    }: GenerateTextParams) => {
      const temperature = 0.7;
      const maxTokens = 8192;
      const smallModel = runtime.getSetting("ANTHROPIC_SMALL_MODEL") ?? "claude-3-5-haiku-latest";

      const { text } = await generateText({
        model: anthropic(smallModel),
        prompt: context,
        // Pass along any system prompt if available.
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        stopSequences,
      });
      return text;
    },

    // TEXT_LARGE generation using Anthropics (e.g. using a "claude-3" model).
    [ModelClass.TEXT_LARGE]: async (
      runtime,
      {
      context,
      stopSequences = [],
    }: GenerateTextParams) => {
      const temperature = 0.7;
      const maxTokens = 8192;
      const largeModel = runtime.getSetting("ANTHROPIC_LARGE_MODEL") ?? "claude-3-5-sonnet-latest";

      const { text } = await generateText({
        model: anthropic(largeModel),
        prompt: context,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        stopSequences,
      });
      return text;
    },
    [ModelClass.TEXT_EMBEDDING]: async (runtime, text: string | null) => {

      // TODO: Make this fallback only!!!
      // TODO: pass on cacheDir to FlagEmbedding.init
      if (!text) return new Array(1536).fill(0);
      
      const model = await FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15 });
      const embedding = await model.queryEmbed(text);
      
      const finalEmbedding = Array.isArray(embedding) 
        ? ArrayBuffer.isView(embedding[0]) 
          ? Array.from(embedding[0] as never)
          : embedding
        : Array.from(embedding);
        
      if (!Array.isArray(finalEmbedding) || finalEmbedding[0] === undefined) {
        throw new Error("Invalid embedding format");
      }
      
      return finalEmbedding.map(Number);
    }
  },
  tests: [
    {
      name: "anthropic_plugin_tests",
      tests: [
        {
          name: 'anthropic_test_text_embedding',
          fn: async (runtime) => {
            try {
              console.log("testing embedding");
              const embedding = await runtime.useModel(ModelClass.TEXT_EMBEDDING, "Hello, world!");
              console.log("embedding done", embedding);
            } catch (error) {
              console.error("Error in test_text_embedding:", error);
              throw error;
            }
          }
        },
        {
          name: 'anthropic_test_text_small',  
          fn: async (runtime) => {
            try {
              const text = await runtime.useModel(ModelClass.TEXT_SMALL, {
                context: "Debug Mode:",
                prompt: "What is the nature of reality in 10 words?",
              });
              if (text.length === 0) {
                throw new Error("Failed to generate text");
              }
              console.log("generated with test_text_small:", text);
            } catch (error) {
              console.error("Error in test_text_small:", error);
              throw error;
            }
          }
        },
        {
          name: 'anthropic_test_text_large',
          fn: async (runtime) => {
            try {
              const text = await runtime.useModel(ModelClass.TEXT_LARGE, {
                context: "Debug Mode:",
                prompt: "What is the nature of reality in 10 words?",
              });
              if (text.length === 0) {
                throw new Error("Failed to generate text");
              }
              console.log("generated with test_text_large:", text);
            } catch (error) {
              console.error("Error in test_text_large:", error);
              throw error;
            }
          }
        }
      ]
    }
  ]

};

export default anthropicPlugin;
