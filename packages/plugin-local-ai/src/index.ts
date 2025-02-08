import { z } from "zod";
import type { Plugin } from "@elizaos/core";
import { ModelType, logger } from "@elizaos/core";
import { AutoTokenizer } from "@huggingface/transformers";
import { FlagEmbedding, EmbeddingModel } from "fastembed";
import path from "node:path";
import { fileURLToPath } from "url";

// Configuration schema for the local AI plugin
const configSchema = z.object({
  LLAMALOCAL_PATH: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  TOKENIZER_MODEL: z.string().optional().default("gpt-4o"),
  CACHE_DIR: z.string().optional().default("./cache"),
});

class LocalAIManager {
  tokenizer: any;
  embeddingModel: FlagEmbedding | null;

  async initializeEmbeddingModel() {
    if (this.embeddingModel) return;

    try {
      // Get cache directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const cacheDir = path.resolve(
        __dirname,
        process.env.CACHE_DIR || "./cache"
      );

      // Ensure cache directory exists
      const fs = await import("fs");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      logger.debug("Initializing BGE embedding model...");

      this.embeddingModel = await FlagEmbedding.init({
        cacheDir: cacheDir,
        model: EmbeddingModel.BGESmallENV15,
        maxLength: 512,
      });

      logger.debug("BGE model initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize BGE model:", error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      await this.initializeEmbeddingModel();
    }

    try {
      const embedding = await this.embeddingModel!.queryEmbed(text);
      return this.processEmbedding(embedding);
    } catch (error) {
      logger.error("Embedding generation failed:", error);
      throw error;
    }
  }

  processEmbedding(embedding: number[]): number[] {
    let finalEmbedding: number[];

    if (
      ArrayBuffer.isView(embedding) &&
      embedding.constructor === Float32Array
    ) {
      finalEmbedding = Array.from(embedding);
    } else if (
      Array.isArray(embedding) &&
      ArrayBuffer.isView(embedding[0]) &&
      embedding[0].constructor === Float32Array
    ) {
      finalEmbedding = Array.from(embedding[0]);
    } else if (Array.isArray(embedding)) {
      finalEmbedding = embedding;
    } else {
      throw new Error(`Unexpected embedding format: ${typeof embedding}`);
    }

    finalEmbedding = finalEmbedding.map((n) => Number(n));

    if (!Array.isArray(finalEmbedding) || finalEmbedding[0] === undefined) {
      throw new Error(
        "Invalid embedding format: must be an array starting with a number"
      );
    }

    if (finalEmbedding.length !== 384) {
      logger.warn(`Unexpected embedding dimension: ${finalEmbedding.length}`);
    }

    return finalEmbedding;
  }
}

const localAIManager = new LocalAIManager();

export const localAIPlugin: Plugin = {
  name: "local-ai",
  description: "Local AI plugin using LLaMA, AutoTokenizer and FastEmbed",

  async init(config: Record<string, string>) {
    try {
      const validatedConfig = await configSchema.parseAsync(config);
      Object.entries(validatedConfig).forEach(([key, value]) => {
        if (value) process.env[key] = value;
      });

      // Initialize tokenizer
      const tokenizerModel = validatedConfig.TOKENIZER_MODEL;
      localAIManager.tokenizer = await AutoTokenizer.from_pretrained(
        tokenizerModel
      );
      logger.info(`Initialized AutoTokenizer with model: ${tokenizerModel}`);

      // Pre-initialize embedding model
      await localAIManager.initializeEmbeddingModel();
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
    // Text generation for small tasks
    [ModelType.TEXT_SMALL]: async ({
      context,
      stopSequences = [],
      runtime,
    }) => {
      try {
        const modelPath = process.env.LLAMALOCAL_PATH || "./model.gguf";

        return await runtime.call(ModelType.TEXT_SMALL, {
          prompt: context,
          temperature: 0.7,
          maxTokens: 2048,
          stopSequences,
          model: modelPath,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
        });
      } catch (error) {
        logger.error("Error in TEXT_SMALL handler:", error);
        throw error;
      }
    },

    // Text generation for larger tasks
    [ModelType.TEXT_LARGE]: async ({
      context,
      stopSequences = [],
      runtime,
    }) => {
      try {
        const modelPath = process.env.LLAMALOCAL_PATH || "./model.gguf";

        return await runtime.call(ModelType.TEXT_LARGE, {
          prompt: context,
          temperature: 0.8,
          maxTokens: 4096,
          stopSequences,
          model: modelPath,
          frequencyPenalty: 0.7,
          presencePenalty: 0.7,
        });
      } catch (error) {
        logger.error("Error in TEXT_LARGE handler:", error);
        throw error;
      }
    },

    // Text embedding using FastEmbed
    [ModelType.TEXT_EMBEDDING]: async ({ text }) => {
      try {
        return await localAIManager.generateEmbedding(text);
      } catch (error) {
        logger.error("Error in TEXT_EMBEDDING handler:", error);
        throw error;
      }
    },

    // Text tokenization using AutoTokenizer
    [ModelType.TEXT_TOKENIZER_ENCODE]: async ({ text }) => {
      try {
        if (!localAIManager.tokenizer) {
          throw new Error("Tokenizer not initialized");
        }
        return await localAIManager.tokenizer.encode(text);
      } catch (error) {
        logger.error("Error in TEXT_TOKENIZER_ENCODE handler:", error);
        throw error;
      }
    },

    // Text detokenization using AutoTokenizer
    [ModelType.TEXT_TOKENIZER_DECODE]: async ({ tokens }) => {
      try {
        if (!localAIManager.tokenizer) {
          throw new Error("Tokenizer not initialized");
        }
        return await localAIManager.tokenizer.decode(tokens);
      } catch (error) {
        logger.error("Error in TEXT_TOKENIZER_DECODE handler:", error);
        throw error;
      }
    },

    // Image description using local Florence model
    [ModelType.IMAGE_DESCRIPTION]: async ({ imageUrl, runtime }) => {
      try {
        return await runtime.call(ModelType.IMAGE_DESCRIPTION, {
          imageUrl,
          modelProvider: "LLAMALOCAL",
        });
      } catch (error) {
        logger.error("Error in IMAGE_DESCRIPTION handler:", error);
        throw error;
      }
    },
  },
};

export default localAIPlugin;
