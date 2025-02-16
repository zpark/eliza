import { type IAgentRuntime, logger, ModelClass, type Plugin } from "@elizaos/core";
import type { GenerateTextParams } from "@elizaos/core";
import { exec } from "node:child_process";
import * as Echogarden from "echogarden";
import { EmbeddingModel, FlagEmbedding } from "fastembed";
import fs from "node:fs";
import {
  getLlama,
  type Llama,
  LlamaChatSession,
  type LlamaContext,
  type LlamaContextSequence,
  type LlamaModel
} from "node-llama-cpp";
import { nodewhisper } from "nodejs-whisper";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import https from "node:https";
import { getPlatformManager } from "./utils/platform";
import { TokenizerManager } from './utils/tokenizerManager';
import { MODEL_SPECS, type ModelSpec } from './types';
import { DownloadManager } from './utils/downloadManager';
import { VisionManager } from './utils/visionManager';
import { TranscribeManager } from './utils/transcribeManager';
import { TTSManager } from './utils/ttsManager';

// const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration schema
const configSchema = z.object({
  LLAMALOCAL_PATH: z.string().optional(),
  CACHE_DIR: z.string().optional().default("./cache"),
});

// Words to punish in LLM responses
const wordsToPunish = [
  " please", " feel", " free", "!", "–", "—", "?", ".", ",", "; ",
  " cosmos", " tapestry", " tapestries", " glitch", " matrix", " cyberspace",
  " troll", " questions", " topics", " discuss", " basically", " simulation",
  " simulate", " universe", " like", " debug", " debugging", " wild",
  " existential", " juicy", " circuits", " help", " ask", " happy", " just",
  " cosmic", " cool", " joke", " punchline", " fancy", " glad", " assist",
  " algorithm", " Indeed", " Furthermore", " However", " Notably", " Therefore"
];

class LocalAIManager {
  private static instance: LocalAIManager | null = null;
  private llama: Llama | undefined;
  private smallModel: LlamaModel | undefined;
  private mediumModel: LlamaModel | undefined;
  private ctx: LlamaContext | undefined;
  private sequence: LlamaContextSequence | undefined;
  private chatSession: LlamaChatSession | undefined;
  private modelPath: string;
  private mediumModelPath: string;
  private cacheDir: string;
  private embeddingModel: FlagEmbedding | null = null;
  private tokenizerManager: TokenizerManager;
  private downloadManager: DownloadManager;
  private visionManager: VisionManager;
  private activeModelConfig: ModelSpec;
  private transcribeManager: TranscribeManager;
  private ttsManager: TTSManager;

  private constructor() {
    // Ensure we have a valid models directory
    const modelsDir = process.env.LLAMALOCAL_PATH?.trim() 
      ? path.resolve(process.env.LLAMALOCAL_PATH.trim())
      : path.join(process.cwd(), "models");
    
    logger.info("Models directory configuration:", {
      envPath: process.env.LLAMALOCAL_PATH,
      resolvedModelsDir: modelsDir,
      cwd: process.cwd()
    });

    this.activeModelConfig = MODEL_SPECS.small;
    this.modelPath = path.join(modelsDir, MODEL_SPECS.small.name);
    this.mediumModelPath = path.join(modelsDir, MODEL_SPECS.medium.name);
    this.cacheDir = path.join(process.cwd(), process.env.CACHE_DIR || "./cache");
    
    logger.info("Path configuration:", {
      smallModelPath: this.modelPath,
      mediumModelPath: this.mediumModelPath,
      cacheDir: this.cacheDir
    });

    this.downloadManager = DownloadManager.getInstance(this.cacheDir);
    this.tokenizerManager = TokenizerManager.getInstance(this.cacheDir);
    this.visionManager = VisionManager.getInstance(this.cacheDir);
    this.transcribeManager = TranscribeManager.getInstance(this.cacheDir);
    this.ttsManager = TTSManager.getInstance(this.cacheDir);
  }

  public static getInstance(): LocalAIManager {
    if (!LocalAIManager.instance) {
      LocalAIManager.instance = new LocalAIManager();
    }
    return LocalAIManager.instance;
  }

  private async downloadModel(): Promise<void> {
    try {
      // Determine which model to download based on current modelPath
      const isLargeModel = this.modelPath === this.mediumModelPath;
      const modelSpec = isLargeModel ? MODEL_SPECS.medium : MODEL_SPECS.small;
      await this.downloadManager.downloadModel(modelSpec, this.modelPath);
    } catch (error) {
      logger.error("Model download failed:", {
        error: error instanceof Error ? error.message : String(error),
        modelPath: this.modelPath
      });
      throw error;
    }
  }

  public async checkPlatformCapabilities(): Promise<void> {
    try {
      const platformManager = getPlatformManager();
      await platformManager.initialize();
      const capabilities = platformManager.getCapabilities();
      
      logger.info("Platform capabilities detected:", {
        platform: capabilities.platform,
        gpu: capabilities.gpu?.type || "none",
        recommendedModel: capabilities.recommendedModelSize,
        supportedBackends: capabilities.supportedBackends
      });
    } catch (error) {
      logger.warn("Platform detection failed:", error);
    }
  }

  async initialize(modelClass: ModelClass = ModelClass.TEXT_SMALL): Promise<void> {
    try {
      logger.info("Initializing LocalAI Manager for model class:", modelClass);
      
      // Set the correct model path and download if needed
      if (modelClass === ModelClass.TEXT_LARGE) {
        this.modelPath = this.mediumModelPath;
      }
      await this.downloadModel();
      
      this.llama = await getLlama();
      
      // Initialize the appropriate model
      if (modelClass === ModelClass.TEXT_LARGE) {
        this.activeModelConfig = MODEL_SPECS.medium;
        this.mediumModel = await this.llama.loadModel({
          modelPath: this.mediumModelPath
        });
        this.ctx = await this.mediumModel.createContext({ contextSize: MODEL_SPECS.medium.contextSize });
      } else {
        this.activeModelConfig = MODEL_SPECS.small;
        this.smallModel = await this.llama.loadModel({
          modelPath: this.modelPath
        });
        this.ctx = await this.smallModel.createContext({ contextSize: MODEL_SPECS.small.contextSize });
      }

      if (!this.ctx) {
        throw new Error("Failed to create context");
      }

      this.sequence = this.ctx.getSequence();
      logger.success("Model initialization complete");
    } catch (error) {
      logger.error("Initialization failed:", error);
      throw error;
    }
  }

  public async initializeEmbedding(): Promise<void> {
    try {
      logger.info("Initializing embedding model...");
      logger.info("Cache directory:", this.cacheDir);
      
      if (!this.embeddingModel) {
        logger.info("Creating new FlagEmbedding instance with BGESmallENV15 model");
        this.embeddingModel = await FlagEmbedding.init({
          cacheDir: this.cacheDir,
          model: EmbeddingModel.BGESmallENV15,
          maxLength: 512,
          showDownloadProgress: true
        });
        logger.info("FlagEmbedding instance created successfully");
      }
      
      // Verify the model is working with a test embedding
      logger.info("Testing embedding model with sample text...");
      const testEmbed = await this.embeddingModel.queryEmbed("test");
      logger.info("Test embedding generated successfully, dimensions:", testEmbed.length);
      
      logger.success("Embedding model initialization complete");
    } catch (error) {
      logger.error("Embedding initialization failed with details:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        cacheDir: this.cacheDir,
        model: EmbeddingModel.BGESmallENV15
      });
      throw error;
    }
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    try {
      // Initialize with the appropriate model class if not initialized
      if (!this.sequence || !this.smallModel || (params.modelClass === ModelClass.TEXT_LARGE && !this.mediumModel)) {
        await this.initialize(params.modelClass);
      }

      // Select the appropriate model based on the model class
      let activeModel: LlamaModel;
      if (params.modelClass === ModelClass.TEXT_LARGE) {
        if (!this.mediumModel) {
          throw new Error("Medium model not initialized");
        }
        this.activeModelConfig = MODEL_SPECS.medium;
        activeModel = this.mediumModel;
        // QUICK TEST FIX: Always create fresh context
        this.ctx = await activeModel.createContext({ contextSize: MODEL_SPECS.medium.contextSize });
      } else {
        if (!this.smallModel) {
          throw new Error("Small model not initialized");
        }
        this.activeModelConfig = MODEL_SPECS.small;
        activeModel = this.smallModel;
        // QUICK TEST FIX: Always create fresh context
        this.ctx = await activeModel.createContext({ contextSize: MODEL_SPECS.small.contextSize });
      }

      if (!this.ctx) {
        throw new Error("Failed to create context");
      }
      
      // QUICK TEST FIX: Always get fresh sequence
      this.sequence = this.ctx.getSequence();

      // QUICK TEST FIX: Create new session each time without maintaining state
      // Only use valid options for LlamaChatSession
      this.chatSession = new LlamaChatSession({
        contextSequence: this.sequence,
        // Remove conversationHistory as it's not a valid option
      });

      if (!this.chatSession) {
        throw new Error("Failed to create chat session");
      }

      logger.info("Created new chat session for model:", params.modelClass);

      // Log incoming context for debugging
      logger.info("Incoming context structure:", {
        contextLength: params.context.length,
        hasAction: params.context.includes("action"),
        runtime: !!params.runtime,
        stopSequences: params.stopSequences
      });

      const tokens = await this.tokenizerManager.encode(params.context, this.activeModelConfig);
      logger.info("Input tokens:", { count: tokens.length });

      // QUICK TEST FIX: Add system message to reset context
      const systemMessage = "You are a helpful AI assistant. Respond to the current request only.";
      await this.chatSession.prompt(systemMessage, {
        maxTokens: 1, // Minimal tokens for system message
        temperature: 0.0
      });

      let response = await this.chatSession.prompt(params.context, {
        maxTokens: 8192,
        temperature: 0.7,
        topP: 0.9,
        repeatPenalty: {
          punishTokensFilter: () => activeModel.tokenize(wordsToPunish.join(" ")),
          penalty: 1.2,
          frequencyPenalty: 0.7,
          presencePenalty: 0.7
        }
      });

      // Log raw response for debugging
      logger.info("Raw response structure:", {
        responseLength: response.length,
        hasAction: response.includes("action"),
        hasThinkTag: response.includes("<think>")
      });

      // Clean think tags if present
      if (response.includes("<think>")) {
        logger.info("Cleaning think tags from response");
        response = response.replace(/<think>[\s\S]*?<\/think>\n?/g, "");
        logger.info("Think tags removed from response");
      }

      // Return the raw response and let the framework handle JSON parsing and action validation
      return response;
    } catch (error) {
      logger.error("Text generation failed:", error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      logger.info("Generating embedding...");
      // Add null check
      if (!text) {
        throw new Error("Input text cannot be null or undefined");
      }
      logger.debug("Input text length:", text.length);

      if (!this.embeddingModel) {
        logger.error("Embedding model not initialized, attempting to initialize...");
        await this.initializeEmbedding();
      }

      if (!this.embeddingModel) {
        throw new Error("Failed to initialize embedding model");
      }

      logger.info("Generating query embedding...");
      const embedding = await this.embeddingModel.queryEmbed(text);
      const dimensions = embedding.length;
      logger.info("Embedding generation complete", { dimensions });
      
      return Array.from(embedding);
    } catch (error) {
      logger.error("Embedding generation failed:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        // Only access text.length if text exists
        textLength: text?.length ?? 'text is null'
      });
      throw error;
    }
  }

  public async describeImage(imageData: Buffer, mimeType: string): Promise<{ title: string; description: string }> {
    try {
      // Convert buffer to data URL
      const base64 = imageData.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return await this.visionManager.processImage(dataUrl);
    } catch (error) {
      logger.error("Image description failed:", error);
      throw error;
    }
  }

  public async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const result = await this.transcribeManager.transcribe(audioBuffer);
      return result.text;
    } catch (error) {
      logger.error("Audio transcription failed:", {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: audioBuffer.length
      });
      throw error;
    }
  }

  public async generateSpeech(text: string): Promise<Readable> {
    try {
      return await this.ttsManager.generateSpeech(text);
    } catch (error) {
      logger.error("Speech generation failed:", {
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length
      });
      throw error;
    }
  }

  // Add public accessor methods
  public getTokenizerManager(): TokenizerManager {
    return this.tokenizerManager;
  }

  public getActiveModelConfig(): ModelSpec {
    return this.activeModelConfig;
  }
}

// Create manager instance
const localAIManager = LocalAIManager.getInstance();

export const localAIPlugin: Plugin = {
  name: "local-ai",
  description: "Local AI plugin using LLaMA models",

  async init(config: Record<string, string>) {
    try {
      logger.info("Initializing local-ai plugin...");
      const validatedConfig = await configSchema.parseAsync(config);

      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) {
          process.env[key] = value;
          logger.debug(`Set ${key}=${value}`);
        }
      }

      const manager = LocalAIManager.getInstance();

      // Initialize each component in sequence
      logger.info("Starting platform capabilities check...");
      await manager.checkPlatformCapabilities();
      logger.success("Platform capabilities check complete");

      logger.info("Starting LLaMA initialization...");
      await manager.initialize();
      logger.success("LLaMA initialization complete");

      logger.info("Starting embedding model initialization...");
      await manager.initializeEmbedding();
      logger.success("Embedding model initialization complete");

      logger.success("local-ai plugin initialization complete");
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(", ")}`
        );
      }
      logger.error("Plugin initialization failed:", error);
      throw error;
    }
  },

  models: {
    [ModelClass.TEXT_SMALL]: async (runtime: IAgentRuntime, { context, stopSequences = [] }: GenerateTextParams) => {
      try {
        return await localAIManager.generateText({ 
          context, 
          stopSequences,
          runtime,
          modelClass: ModelClass.TEXT_SMALL
        });
      } catch (error) {
        logger.error("Error in TEXT_SMALL handler:", error);
        throw error;
      }
    },

    [ModelClass.TEXT_LARGE]: async (runtime: IAgentRuntime, { context, stopSequences = [] }: GenerateTextParams) => {
      try {
        return await localAIManager.generateText({ 
          context, 
          stopSequences,
          runtime,
          modelClass: ModelClass.TEXT_LARGE
        });
      } catch (error) {
        logger.error("Error in TEXT_LARGE handler:", error);
        throw error;
      }
    },

    [ModelClass.TEXT_EMBEDDING]: async (_runtime: IAgentRuntime, text: string | null) => {
      try {
        // Add detailed logging of the input text and its structure
        logger.info("TEXT_EMBEDDING handler - Initial input:", {
          text,
          type: typeof text,
          isString: typeof text === 'string',
          isObject: typeof text === 'object',
          hasThinkTag: typeof text === 'string' && text.includes('<think>'),
          length: text?.length,
          rawText: text // Log the complete raw text
        });

        // If text is an object, log its structure
        if (typeof text === 'object' && text !== null) {
          logger.info("TEXT_EMBEDDING handler - Object structure:", {
            keys: Object.keys(text),
            stringified: JSON.stringify(text, null, 2)
          });
        }

        // Handle null/undefined/empty text
        if (!text) {
          logger.warn("Null or empty text input for embedding");
          return new Array(384).fill(0);
        }

        // Pass the raw text directly to the framework without any manipulation
        return await localAIManager.generateEmbedding(text);
      } catch (error) {
        logger.error("Error in TEXT_EMBEDDING handler:", {
          error: error instanceof Error ? error.message : String(error),
          fullText: text,
          textType: typeof text,
          textStructure: text !== null ? JSON.stringify(text, null, 2) : 'null'
        });
        return new Array(384).fill(0);
      }
    },

    [ModelClass.TEXT_TOKENIZER_ENCODE]: async (_runtime: IAgentRuntime, { text }: { text: string }) => {
      try {
        const manager = localAIManager.getTokenizerManager();
        const config = localAIManager.getActiveModelConfig();
        return await manager.encode(text, config);
      } catch (error) {
        logger.error("Error in TEXT_TOKENIZER_ENCODE handler:", error);
        throw error;
      }
    },

    [ModelClass.TEXT_TOKENIZER_DECODE]: async (_runtime: IAgentRuntime, { tokens }: { tokens: number[] }) => {
      try {
        const manager = localAIManager.getTokenizerManager();
        const config = localAIManager.getActiveModelConfig();
        return await manager.decode(tokens, config);
      } catch (error) {
        logger.error("Error in TEXT_TOKENIZER_DECODE handler:", error);
        throw error;
      }
    },

    [ModelClass.IMAGE_DESCRIPTION]: async (_runtime: IAgentRuntime, imageUrl: string) => {
      try {
        logger.info("Processing image from URL:", imageUrl);
        
        // Fetch the image from URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        
        return await localAIManager.describeImage(buffer, mimeType);
      } catch (error) {
        logger.error("Error in IMAGE_DESCRIPTION handler:", {
          error: error instanceof Error ? error.message : String(error),
          imageUrl
        });
        throw error;
      }
    },

    [ModelClass.TRANSCRIPTION]: async (_runtime: IAgentRuntime, audioBuffer: Buffer) => {
      try {
        logger.info("Processing audio transcription:", {
          bufferSize: audioBuffer.length
        });
        
        return await localAIManager.transcribeAudio(audioBuffer);
      } catch (error) {
        logger.error("Error in TRANSCRIPTION handler:", {
          error: error instanceof Error ? error.message : String(error),
          bufferSize: audioBuffer.length
        });
        throw error;
      }
    },

    [ModelClass.TEXT_TO_SPEECH]: async (_runtime: IAgentRuntime, text: string) => {
      try {
        return await localAIManager.generateSpeech(text);
      } catch (error) {
        logger.error("Error in TEXT_TO_SPEECH handler:", {
          error: error instanceof Error ? error.message : String(error),
          textLength: text.length
        });
        throw error;
      }
    },
  }
};

export default localAIPlugin;
