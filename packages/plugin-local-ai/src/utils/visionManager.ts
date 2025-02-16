import { logger } from "@elizaos/core";
import {
  AutoProcessor,
  AutoTokenizer,
  env,
  Florence2ForConditionalGeneration,
  type Florence2Processor,
  type PreTrainedTokenizer,
  RawImage,
  type Tensor,
  type ModelOutput,
  type PreTrainedModel
} from "@huggingface/transformers";
import { MODEL_SPECS } from "../types";

export class VisionManager {
  private static instance: VisionManager | null = null;
  private model: Florence2ForConditionalGeneration | null = null;
  private processor: Florence2Processor | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private cacheDir: string;
  private initialized = false;

  private constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  public static getInstance(cacheDir: string): VisionManager {
    if (!VisionManager.instance) {
      VisionManager.instance = new VisionManager(cacheDir);
    }
    return VisionManager.instance;
  }

  private async initialize() {
    try {
      if (this.initialized) return;

      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.backends.onnx.logLevel = "fatal";
      const modelId = MODEL_SPECS.vision.modelId;

      logger.info("Initializing vision model...");
      
      // Initialize model
      const model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
        device: "gpu",
        cache_dir: this.cacheDir
      });
      
      // Type assertion since we know this is the correct model type
      this.model = model as Florence2ForConditionalGeneration;

      // Initialize processor
      this.processor = await AutoProcessor.from_pretrained(modelId, {
        device: "gpu",
        cache_dir: this.cacheDir
      }) as Florence2Processor;

      // Initialize tokenizer
      this.tokenizer = await AutoTokenizer.from_pretrained(modelId, {
        cache_dir: this.cacheDir
      });

      this.initialized = true;
      logger.success("Vision model initialization complete");
    } catch (error) {
      logger.error("Vision model initialization failed:", error);
      throw error;
    }
  }

  private async fetchImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      logger.info("Fetching image from URL:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get("content-type") || "image/jpeg";
      return { buffer, mimeType };
    } catch (error) {
      logger.error("Failed to fetch image:", error);
      throw error;
    }
  }

  public async processImage(imageUrl: string): Promise<{ title: string; description: string }> {
    try {
      await this.initialize();

      if (!this.model || !this.processor || !this.tokenizer) {
        throw new Error("Vision model not initialized properly");
      }

      // Fetch image from URL
      const { buffer, mimeType } = await this.fetchImage(imageUrl);

      // Process image
      const blob = new Blob([buffer], { type: mimeType });
      // @ts-ignore - RawImage.fromBlob expects web Blob but works with node Blob
      const image = await RawImage.fromBlob(blob);
      const visionInputs = await this.processor(image);
      const prompts = this.processor.construct_prompts("<DETAILED_CAPTION>");
      const textInputs = this.tokenizer(prompts);

      // Generate description
      const generatedIds = await this.model.generate({
        ...textInputs,
        ...visionInputs,
        max_new_tokens: MODEL_SPECS.vision.maxTokens,
      }) as Tensor;

      const generatedText = this.tokenizer.batch_decode(generatedIds, {
        skip_special_tokens: false,
      })[0];

      const result = this.processor.post_process_generation(
        generatedText,
        "<DETAILED_CAPTION>",
        image.size
      );

      const detailedCaption = result["<DETAILED_CAPTION>"] as string;
      return {
        title: `${detailedCaption.split('.')[0]}.`,
        description: detailedCaption
      };
    } catch (error) {
      logger.error("Image processing failed:", error);
      throw error;
    }
  }
}
