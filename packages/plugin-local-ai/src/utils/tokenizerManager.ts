import {
  AutoTokenizer,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import { logger } from "@elizaos/core";

// Import the MODEL_SPECS type from a new types file we'll create later
import type { ModelSpec } from "../types";

export class TokenizerManager {
  private static instance: TokenizerManager | null = null;
  private tokenizers: Map<string, PreTrainedTokenizer>;
  private cacheDir: string;

  private constructor(cacheDir: string) {
    this.tokenizers = new Map();
    this.cacheDir = cacheDir;
  }

  static getInstance(cacheDir: string): TokenizerManager {
    if (!TokenizerManager.instance) {
      TokenizerManager.instance = new TokenizerManager(cacheDir);
    }
    return TokenizerManager.instance;
  }

  async loadTokenizer(modelConfig: ModelSpec): Promise<PreTrainedTokenizer> {
    try {
      const tokenizerKey = `${modelConfig.tokenizer.type}-${modelConfig.tokenizer.name}`;
      logger.info("Loading tokenizer:", {
        key: tokenizerKey,
        name: modelConfig.tokenizer.name,
        type: modelConfig.tokenizer.type,
        cacheDir: this.cacheDir
      });

      if (this.tokenizers.has(tokenizerKey)) {
        logger.info("Using cached tokenizer:", { key: tokenizerKey });
        const cachedTokenizer = this.tokenizers.get(tokenizerKey);
        if (!cachedTokenizer) {
          throw new Error(`Tokenizer ${tokenizerKey} exists in map but returned undefined`);
        }
        return cachedTokenizer;
      }

      logger.info("Initializing new tokenizer from HuggingFace");
      const tokenizer = await AutoTokenizer.from_pretrained(modelConfig.tokenizer.name, {
        cache_dir: this.cacheDir,
        local_files_only: false
      });

      this.tokenizers.set(tokenizerKey, tokenizer);
      logger.success("Tokenizer loaded successfully:", { key: tokenizerKey });
      return tokenizer;
    } catch (error) {
      logger.error("Failed to load tokenizer:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        model: modelConfig.name,
        tokenizer: modelConfig.tokenizer.name
      });
      throw error;
    }
  }

  async encode(text: string, modelConfig: ModelSpec): Promise<number[]> {
    try {
      const tokenizer = await this.loadTokenizer(modelConfig);
      logger.info("Encoding text:", { length: text.length });
      
      const encoded = await tokenizer.encode(text, {
        add_special_tokens: true,
        return_token_type_ids: false
      });
      
      logger.info("Text encoded successfully:", { tokenCount: encoded.length });
      return encoded;
    } catch (error) {
      logger.error("Text encoding failed:", {
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length
      });
      throw error;
    }
  }

  async decode(tokens: number[], modelConfig: ModelSpec): Promise<string> {
    try {
      const tokenizer = await this.loadTokenizer(modelConfig);
      logger.info("Decoding tokens:", { count: tokens.length });
      
      const decoded = await tokenizer.decode(tokens, {
        skip_special_tokens: true,
        clean_up_tokenization_spaces: true
      });
      
      logger.info("Tokens decoded successfully:", { textLength: decoded.length });
      return decoded;
    } catch (error) {
      logger.error("Token decoding failed:", {
        error: error instanceof Error ? error.message : String(error),
        tokenCount: tokens.length
      });
      throw error;
    }
  }
}
