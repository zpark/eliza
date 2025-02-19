import { logger } from "@elizaos/core";
import fs from "node:fs";
import path from "node:path";
import { getLlama, type LlamaModel, type LlamaContext, type LlamaContextSequence, type Token } from "node-llama-cpp";
import { MODEL_SPECS } from "../types";
import { Readable } from "node:stream";
import { prependWavHeader } from "./audioUtils";
import { DownloadManager } from "./downloadManager";

interface TTSResponse {
  tokens: number[];
  audio?: Float32Array;
}

export class TTSManager {
  private static instance: TTSManager | null = null;
  private cacheDir: string;
  private model: LlamaModel | null = null;
  private ctx: LlamaContext | null = null;
  private sequence: LlamaContextSequence | null = null;
  private initialized = false;
  private downloadManager: DownloadManager;
  private modelsDir: string;

  private constructor(cacheDir: string) {
    this.cacheDir = path.join(cacheDir, 'tts');
    this.modelsDir = process.env.LLAMALOCAL_PATH?.trim() 
      ? path.resolve(process.env.LLAMALOCAL_PATH.trim())
      : path.join(process.cwd(), "models");
    this.downloadManager = DownloadManager.getInstance(this.cacheDir);
    this.ensureCacheDirectory();
  }

  public static getInstance(cacheDir: string): TTSManager {
    if (!TTSManager.instance) {
      TTSManager.instance = new TTSManager(cacheDir);
    }
    return TTSManager.instance;
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info("Created TTS cache directory:", this.cacheDir);
    }
  }

  private async initialize(): Promise<void> {
    try {
      if (this.initialized && this.model && this.ctx) {
        return;
      }

      logger.info("Initializing TTS with GGUF backend...");
      
      // Download the model if needed
      const modelPath = path.join(this.modelsDir, MODEL_SPECS.tts.base.name);
      await this.downloadManager.downloadModel(MODEL_SPECS.tts.base, modelPath);
      
      const llama = await getLlama();
      this.model = await llama.loadModel({
        modelPath
      });

      this.ctx = await this.model.createContext({
        contextSize: MODEL_SPECS.tts.base.contextSize
      });

      this.sequence = this.ctx.getSequence();
      
      logger.success("TTS initialization complete");
      this.initialized = true;
    } catch (error) {
      logger.error("TTS initialization failed:", {
        error: error instanceof Error ? error.message : String(error),
        model: MODEL_SPECS.tts.base.name
      });
      throw error;
    }
  }

  public async generateSpeech(text: string): Promise<Readable> {
    try {
      await this.initialize();
      
      if (!this.model || !this.ctx || !this.sequence) {
        throw new Error("TTS model not initialized");
      }
      
      logger.info("Generating speech for text:", { length: text.length });

      // Format prompt for TTS generation
      const prompt = `[SPEAKER=male_1][LANGUAGE=en]${text}`;
      
      // Tokenize the input text
      const inputTokens = this.model.tokenize(prompt);
      
      // Generate audio tokens
      const responseTokens: Token[] = [];
      for await (const token of this.sequence.evaluate(inputTokens, {
        temperature: 0.1,
        repeatPenalty: {
          punishTokens: () => [],
          penalty: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0
        }
      })) {
        responseTokens.push(token);
      }

      // Convert tokens to audio data
      if (!this.model) {
        throw new Error("Model not initialized");
      }
      const audioData = this.processAudioResponse({
        tokens: responseTokens.map(t => Number.parseInt(this.model.detokenize([t]), 10))
      });
      
      // Create WAV format with proper headers
      return prependWavHeader(
        Readable.from(audioData),
        audioData.length,
        MODEL_SPECS.tts.base.sampleRate,
        1, // mono channel
        16 // 16-bit PCM
      );
    } catch (error) {
      logger.error("Speech generation failed:", {
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length
      });
      throw error;
    }
  }

  private processAudioResponse(response: TTSResponse): Buffer {
    if (response.audio) {
      // If we have direct audio data, convert Float32Array to 16-bit PCM
      const pcmData = new Int16Array(response.audio.length);
      for (let i = 0; i < response.audio.length; i++) {
        // Convert float to 16-bit PCM
        const s = Math.max(-1, Math.min(1, response.audio[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return Buffer.from(pcmData.buffer);
    }
    
    // If we only have tokens, convert them to PCM data
    // This is a placeholder implementation - actual conversion depends on model
    const pcmData = new Int16Array(response.tokens.length * 2);
    for (let i = 0; i < response.tokens.length; i++) {
      // Simple conversion for testing - replace with actual model-specific conversion
      pcmData[i * 2] = response.tokens[i] & 0xFFFF;
      pcmData[i * 2 + 1] = (response.tokens[i] >> 16) & 0xFFFF;
    }
    return Buffer.from(pcmData.buffer);
  }
}
