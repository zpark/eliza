import { logger } from "@elizaos/core";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import type { ModelSpec } from "../types";

export class DownloadManager {
  private static instance: DownloadManager | null = null;
  private cacheDir: string;

  private constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }

  public static getInstance(cacheDir: string): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager(cacheDir);
    }
    return DownloadManager.instance;
  }

  private ensureCacheDirectory(): void {
    logger.info("Ensuring cache directory exists:", this.cacheDir);
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info("Created cache directory");
    }
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Starting download to: ${destPath}`);
      
      // Create a temporary file path in the same directory as destPath
      const tempPath = `${destPath}.tmp`;
      
      const request = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 300000 // Increase timeout to 5 minutes
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect location not found'));
            return;
          }
          logger.info(`Following redirect to: ${redirectUrl}`);
          this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const totalSize = Number.parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        let lastLoggedPercent = 0;

        const file = fs.createWriteStream(tempPath);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const percent = Math.round((downloadedSize / totalSize) * 100);
          
          // Log progress every 10%
          if (percent >= lastLoggedPercent + 10) {
            logger.info(`Download progress: ${percent}%`);
            lastLoggedPercent = percent;
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          
          // Move temp file to final destination
          try {
            if (fs.existsSync(destPath)) {
              fs.unlinkSync(destPath);
            }
            fs.renameSync(tempPath, destPath);
            logger.success('Download completed successfully');
            resolve();
          } catch (err) {
            fs.unlinkSync(tempPath);
            reject(err);
          }
        });

        file.on('error', (err) => {
          fs.unlinkSync(tempPath);
          reject(err);
        });
      });

      request.on('error', (err) => {
        fs.unlinkSync(tempPath);
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy();
        fs.unlinkSync(tempPath);
        reject(new Error('Download timeout'));
      });
    });
  }

  public async downloadModel(modelSpec: ModelSpec, modelPath: string): Promise<void> {
    try {
      logger.info("Starting model download...");
      
      // Ensure model directory exists
      const modelDir = path.dirname(modelPath);
      if (!fs.existsSync(modelDir)) {
        logger.info("Creating model directory:", modelDir);
        fs.mkdirSync(modelDir, { recursive: true });
      }

      if (!fs.existsSync(modelPath)) {
        // For GGUF models, we need to adjust the repo path
        const repoPath = modelSpec.repo.replace('-GGUF', '');
        const downloadUrl = `https://huggingface.co/${repoPath}/resolve/main/${modelSpec.name}`;
        logger.info("Model download details:", {
          originalRepo: modelSpec.repo,
          adjustedRepo: repoPath,
          modelName: modelSpec.name,
          downloadUrl,
          alternativeUrls: {
            withGGUF: `https://huggingface.co/${modelSpec.repo}/resolve/main/${modelSpec.name}`,
            rawUrl: `https://huggingface.co/${modelSpec.repo}/blob/main/${modelSpec.name}`,
            lfsUrl: `https://huggingface.co/${modelSpec.repo}/resolve/main/${modelSpec.name}?download=true`
          },
          modelPath: modelPath,
          timestamp: new Date().toISOString()
        });
        
        await this.downloadFile(downloadUrl, modelPath);
        logger.success(`Model download complete: ${modelSpec.name}`);
      } else {
        logger.info("Model already exists at:", modelPath);
      }
    } catch (error) {
      logger.error("Model download failed:", {
        error: error instanceof Error ? error.message : String(error),
        modelPath: modelPath,
        model: modelSpec.name
      });
      throw error;
    }
  }

  public getCacheDir(): string {
    return this.cacheDir;
  }

  public async downloadFromUrl(url: string, destPath: string): Promise<void> {
    return this.downloadFile(url, destPath);
  }

  public ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  }
}
