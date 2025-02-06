// TODO: Maybe create these functions to read from character settings or env
// import { getEmbeddingModelSettings, getEndpoint } from "./models.ts";
import { type IAgentRuntime, ModelProviderName, ModelClass } from "./types.ts";
import settings from "./settings.ts";
import elizaLogger from "./logger.ts";
import LocalEmbeddingModelManager from "./localembeddingManager.ts";

interface EmbeddingOptions {
    model: string;
    endpoint: string;
    apiKey?: string;
    length?: number;
    isOllama?: boolean;
    dimensions?: number;
    provider?: string;
}
 
export const EmbeddingProvider = {
    OpenAI: "OpenAI",
    Ollama: "Ollama",
    GaiaNet: "GaiaNet",
    Heurist: "Heurist",
    BGE: "BGE",
} as const;

export type EmbeddingConfig = {
    readonly dimensions: number;
    readonly model: string;
    readonly provider: string;
};

export const getEmbeddingConfig = (runtime?: IAgentRuntime): EmbeddingConfig => {
    if (runtime) {
        const modelProvider = runtime.getModelProvider();
        const embeddingModel = modelProvider?.models?.[ModelClass.EMBEDDING];
        
        if (embeddingModel?.name) {
            return {
                dimensions: embeddingModel.dimensions || 1536,
                model: embeddingModel.name,
                provider: modelProvider?.provider || EmbeddingProvider.OpenAI,
            };
        }
    }
    
    // Fallback to default config
    return {
        dimensions: 1536, // OpenAI's text-embedding-ada-002 dimension
        model: "text-embedding-3-small", // Default to OpenAI's latest embedding model
        provider: EmbeddingProvider.OpenAI
    };
};

async function getRemoteEmbedding(
    input: string,
    options: EmbeddingOptions
): Promise<number[]> {
    // Ensure endpoint ends with /v1 for OpenAI
    const baseEndpoint = options.endpoint.endsWith("/v1")
        ? options.endpoint
        : `${options.endpoint}${options.isOllama ? "/v1" : ""}`;

    // Construct full URL
    const fullUrl = `${baseEndpoint}/embeddings`;

    elizaLogger.info("Embedding request:", {
        modelProvider: options.provider,
        useOpenAI: options.provider === EmbeddingProvider.OpenAI,
        input: `${input?.slice(0, 50)}...`,
        inputType: typeof input,
        inputLength: input?.length,
        isString: typeof input === "string",
        isEmpty: !input,
    });

    const requestBody: any = {
        input,
        model: options.model,
    };

    // Only include dimensions for non-OpenAI providers
    if (options.provider !== EmbeddingProvider.OpenAI) {
        requestBody.dimensions = options.dimensions || options.length || getEmbeddingConfig().dimensions;
    }

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options.apiKey
                ? {
                      Authorization: `Bearer ${options.apiKey}`,
                  }
                : {}),
        },
        body: JSON.stringify(requestBody),
    };

    try {
        const response = await fetch(fullUrl, requestOptions);

        elizaLogger.info("Embedding response:", requestOptions);

        if (!response.ok) {
            elizaLogger.error("API Response:", await response.text()); // Debug log
            throw new Error(
                `Embedding API Error: ${response.status} ${response.statusText}`
            );
        }

        interface EmbeddingResponse {
            data: Array<{ embedding: number[] }>;
        }

        const data: EmbeddingResponse = await response.json();
        return data?.data?.[0].embedding;
    } catch (e) {
        elizaLogger.error("Error getting remote embedding:", e);
        elizaLogger.error("Full error details:", e);
        throw e;
    }
}

export function getEmbeddingType(runtime: IAgentRuntime): "local" | "remote" {
    const isNode =
        typeof process !== "undefined" &&
        process.versions != null &&
        process.versions.node != null;

    // Use local embedding if:
    // - Running in Node.js
    // - Not using OpenAI provider
    // - Not forcing OpenAI embeddings
    const isLocal = isNode && !settings.USE_OPENAI_EMBEDDING;

    return isLocal ? "local" : "remote";
}

export function getEmbeddingZeroVector(): number[] {
    let embeddingDimension = 384; // Default BGE dimension

    // TODO: add logic to get from character settings

    return Array(embeddingDimension).fill(0);
}

/**
 * Gets embeddings from a remote API endpoint.  Falls back to local BGE/384
 *
 * @param {string} input - The text to generate embeddings for
 * @param {EmbeddingOptions} options - Configuration options including:
 *   - model: The model name to use
 *   - endpoint: Base API endpoint URL
 *   - apiKey: Optional API key for authentication
 *   - isOllama: Whether this is an Ollama endpoint
 *   - dimensions: Desired embedding dimensions
 * @param {IAgentRuntime} runtime - The agent runtime context
 * @returns {Promise<number[]>} Array of embedding values
 * @throws {Error} If the API request fails
 */

export async function embed(runtime: IAgentRuntime, input: string) {
    elizaLogger.debug("Embedding request:", {
        modelProvider: runtime.character.modelProvider,
        useOpenAI: runtime.getSetting("USE_OPENAI_EMBEDDING"),
        input: `${input?.slice(0, 50)}...`,
        inputType: typeof input,
        inputLength: input?.length,
        isString: typeof input === "string",
        isEmpty: !input,
    });

    // Validate input
    if (!input || typeof input !== "string" || input.trim().length === 0) {
        elizaLogger.warn("Invalid embedding input:", {
            input,
            type: typeof input,
            length: input?.length,
        });
        return []; // Return empty embedding array
    }

    // Check cache first
    const cachedEmbedding = await retrieveCachedEmbedding(runtime, input);
    if (cachedEmbedding) return cachedEmbedding;

    const isNode = typeof process !== "undefined" && process.versions?.node;

    // Get embedding configuration from runtime
    const embeddingConfig = getEmbeddingConfig(runtime);

    // BGE - try local first if in Node and not using OpenAI
    if (isNode && embeddingConfig.provider !== EmbeddingProvider.OpenAI) {
        try {
            return await getLocalEmbedding(input);
        } catch (error) {
            elizaLogger.warn(
                "Local embedding failed, falling back to remote",
                error
            );
        }
    }

    // Use remote embedding
    return await getRemoteEmbedding(input, {
        model: embeddingConfig.model,
        endpoint: runtime.character.modelEndpointOverride || runtime.getSetting("PROVIDER_ENDPOINT") || "https://api.openai.com/v1",
        apiKey: runtime.getSetting("PROVIDER_API_KEY") || runtime.token,
        dimensions: embeddingConfig.dimensions,
        provider: embeddingConfig.provider
    });

    async function getLocalEmbedding(input: string): Promise<number[]> {
        elizaLogger.debug("DEBUG - Inside getLocalEmbedding function");

        try {
            const embeddingManager = LocalEmbeddingModelManager.getInstance();
            return await embeddingManager.generateEmbedding(input);
        } catch (error) {
            elizaLogger.error("Local embedding failed:", error);
            throw error;
        }
    }

    async function retrieveCachedEmbedding(
        runtime: IAgentRuntime,
        input: string
    ) {
        if (!input) {
            elizaLogger.log("No input to retrieve cached embedding for");
            return null;
        }

        const similaritySearchResult =
            await runtime.messageManager.getCachedEmbeddings(input);
        if (similaritySearchResult.length > 0) {
            return similaritySearchResult[0].embedding;
        }
        return null;
    }
}
