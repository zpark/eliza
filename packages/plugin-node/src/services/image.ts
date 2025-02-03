import {
    elizaLogger,
    type IAgentRuntime,
    type IImageDescriptionService,
    initializeModelClient,
    ModelProviderName,
    Service,
    ServiceType,
} from "@elizaos/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp, { type AvailableFormatInfo, type FormatEnum } from "sharp";

const IMAGE_DESCRIPTION_PROMPT =
    "Describe this image and give it a title. The first line should be the title, and then a line break, then a detailed description of the image. Respond with the format 'title\\ndescription'";

interface ImageProvider {
    initialize(): Promise<void>;
    describeImage(
        imageData: Buffer,
        mimeType: string
    ): Promise<{ title: string; description: string }>;
}



// Utility functions
const convertToBase64DataUrl = (
    imageData: Buffer,
    mimeType: string
): string => {
    const base64Data = imageData.toString("base64");
    return `data:${mimeType};base64,${base64Data}`;
};

const handleApiError = async (
    response: Response,
    provider: string
): Promise<never> => {
    const responseText = await response.text();
    elizaLogger.error(
        `${provider} API error:`,
        response.status,
        "-",
        responseText
    );
    throw new Error(`HTTP error! status: ${response.status}`);
};

const parseImageResponse = (
    text: string
): { title: string; description: string } => {
    const [title, ...descriptionParts] = text.split("\n");
    return { title, description: descriptionParts.join("\n") };
};


export class OpenAIImageProvider implements ImageProvider {
    constructor(private runtime: IAgentRuntime) {}

    async initialize(): Promise<void> {}

    async describeImage(
        imageData: Buffer,
        mimeType: string
    ): Promise<{ title: string; description: string }> {
        const imageUrl = convertToBase64DataUrl(imageData, mimeType);
        const { apiKey, model, baseURL } = initializeModelClient(this.runtime, true);

        const content = [
            { type: "text", text: IMAGE_DESCRIPTION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
        ];

        const response = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content }],
                max_tokens: 500,
            }),
        });

        if (!response.ok) {
            await handleApiError(response, "OpenAI");
        }

        const data = await response.json();
        return parseImageResponse(data.choices[0].message.content);
    }
}

export class ImageDescriptionService
    extends Service
    implements IImageDescriptionService
{
    static serviceType: ServiceType = ServiceType.IMAGE_DESCRIPTION;

    private initialized = false;
    private runtime: IAgentRuntime | null = null;
    private provider: ImageProvider | null = null;

    getInstance(): IImageDescriptionService {
        return ImageDescriptionService.getInstance();
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.log("Initializing ImageDescriptionService");
        this.runtime = runtime;
    }

    private async initializeProvider(): Promise<boolean> {
        if (!this.runtime) {
            throw new Error("Runtime is required for image recognition");
        }

        const providerName = this.runtime.imageVisionModelProvider || ModelProviderName.OPENAI;
        const Provider = this.runtime.getModelProvider().provider;

        if (!Provider) {
            elizaLogger.error(
                `Unsupported image vision model provider: ${providerName}.`
            );
            return false;
        }

        elizaLogger.debug(`Using ${providerName} for vision model`);

        try {
            await this.provider.initialize();
        } catch (error) {
            elizaLogger.error(
                `Failed to initialize the image vision model provider: ${providerName}`,
                error
            );
            return false;
        }
        return true;
    }

    private async loadImageData(
        imageUrlOrPath: string
    ): Promise<{ data: Buffer; mimeType: string }> {
        let loadedImageData: Buffer;
        let loadedMimeType: string;
        const { imageData, mimeType } = await this.fetchImage(imageUrlOrPath);
        const skipConversion =
            mimeType === "image/jpeg" ||
            mimeType === "image/jpg" ||
            mimeType === "image/png";
        if (skipConversion) {
            loadedImageData = imageData;
            loadedMimeType = mimeType;
        } else {
            const converted = await this.convertImageDataToFormat(
                imageData,
                "png"
            );
            loadedImageData = converted.imageData;
            loadedMimeType = converted.mimeType;
        }
        if (!loadedImageData || loadedImageData.length === 0) {
            throw new Error("Failed to fetch image data");
        }
        return { data: loadedImageData, mimeType: loadedMimeType };
    }

    private async convertImageDataToFormat(
        data: Buffer,
        format: keyof FormatEnum | AvailableFormatInfo = "png"
    ): Promise<{ imageData: Buffer; mimeType: string }> {
        const tempFilePath = path.join(
            os.tmpdir(),
            `tmp_img_${Date.now()}.${format}`
        );
        try {
            await sharp(data).toFormat(format).toFile(tempFilePath);
            const { imageData, mimeType } = await this.fetchImage(tempFilePath);
            return {
                imageData,
                mimeType,
            };
        } finally {
            fs.unlinkSync(tempFilePath); // Clean up temp file
        }
    }

    private async fetchImage(
        imageUrlOrPath: string
    ): Promise<{ imageData: Buffer; mimeType: string }> {
        let imageData: Buffer;
        let mimeType: string;
        if (fs.existsSync(imageUrlOrPath)) {
            imageData = fs.readFileSync(imageUrlOrPath);
            const ext = path.extname(imageUrlOrPath).slice(1).toLowerCase();
            mimeType = ext ? `image/${ext}` : "image/jpeg";
        } else {
            const response = await fetch(imageUrlOrPath);
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch image: ${response.statusText}`
                );
            }
            imageData = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get("content-type") || "image/jpeg";
        }
        return { imageData, mimeType };
    }

    async describeImage(
        imageUrlOrPath: string
    ): Promise<{ title: string; description: string }> {
        if (!this.initialized) {
            this.initialized = await this.initializeProvider();
        }

        if (this.initialized) {
            try {
                const { data, mimeType } =
                    await this.loadImageData(imageUrlOrPath);
                return await this.provider.describeImage(data, mimeType);
            } catch (error) {
                elizaLogger.error("Error in describeImage:", error);
                throw error;
            }
        }
    }
}

export default ImageDescriptionService;
