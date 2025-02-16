import { logger } from "@elizaos/core";
import { nodewhisper } from "nodejs-whisper";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";

const execAsync = promisify(exec);

interface TranscriptionResult {
  text: string;
}

export class TranscribeManager {
  private static instance: TranscribeManager | null = null;
  private cacheDir: string;

  private constructor(cacheDir: string) {
    this.cacheDir = path.join(cacheDir, 'whisper');
    this.ensureCacheDirectory();
  }

  public static getInstance(cacheDir: string): TranscribeManager {
    if (!TranscribeManager.instance) {
      TranscribeManager.instance = new TranscribeManager(cacheDir);
    }
    return TranscribeManager.instance;
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info("Created whisper cache directory:", this.cacheDir);
    }
  }

  private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    try {
      await execAsync(`ffmpeg -y -i "${inputPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputPath}"`);
      logger.info("Audio converted to WAV format successfully");
    } catch (error) {
      logger.error("Audio conversion failed:", error);
      throw new Error("Failed to convert audio to WAV format");
    }
  }

  private async preprocessAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const tempInputFile = path.join(this.cacheDir, `temp_input_${Date.now()}`);
      const tempWavFile = path.join(this.cacheDir, `temp_${Date.now()}.wav`);
      
      // Write buffer to temporary file
      fs.writeFileSync(tempInputFile, audioBuffer);

      // Convert to WAV format
      await this.convertToWav(tempInputFile, tempWavFile);

      // Clean up the input file
      if (fs.existsSync(tempInputFile)) {
        fs.unlinkSync(tempInputFile);
      }

      return tempWavFile;
    } catch (error) {
      logger.error("Audio preprocessing failed:", error);
      throw new Error("Failed to preprocess audio");
    }
  }

  public async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    try {
      logger.info("Starting audio transcription...");
      
      // Preprocess audio to WAV format
      const wavFile = await this.preprocessAudio(audioBuffer);
      
      // Transcribe using whisper
      const output = await nodewhisper(wavFile, {
        modelName: "base.en",
        autoDownloadModelName: "base.en",
        verbose: false,
        whisperOptions: {
          outputInText: true,
          language: "en"
        }
      });

      // Clean up temporary WAV file
      if (fs.existsSync(wavFile)) {
        fs.unlinkSync(wavFile);
      }

      // Return simple text result
      return { text: output.trim() };
    } catch (error) {
      logger.error("Transcription failed:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}
