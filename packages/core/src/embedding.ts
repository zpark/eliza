import path from "node:path";
import settings from "./settings.ts";
import elizaLogger from "./logger.ts";
import { getVoyageAIEmbeddingConfig } from "./voyageai.ts";
import { models, getEmbeddingModelSettings, getEndpoint } from "./models.ts";
import { IAgentRuntime, ModelProviderName } from "./types.ts";
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
    VoyageAI: "VoyageAI",
} as const;

export type EmbeddingProviderType =
    (typeof EmbeddingProvider)[keyof typeof EmbeddingProvider];

export namespace EmbeddingProvider {
    export type OpenAI = typeof EmbeddingProvider.OpenAI;
    export type Ollama = typeof EmbeddingProvider.Ollama;
    export type GaiaNet = typeof EmbeddingProvider.GaiaNet;
    export type BGE = typeof EmbeddingProvider.BGE;
    export type VoyageAI = typeof EmbeddingProvider.VoyageAI;
}

export type EmbeddingConfig = {
    readonly dimensions: number;
    readonly model: string;
    readonly provider: EmbeddingProvider;
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly maxInputTokens?: number;
};

// Get embedding config based on settings
export function getEmbeddingConfig(): EmbeddingConfig {
    if (settings.USE_OPENAI_EMBEDDING?.toLowerCase() === "true") {
        return {
            dimensions: 1536,
            model: "text-embedding-3-small",
            provider: "OpenAI",
            endpoint: "https://api.openai.com/v1",
            apiKey: settings.OPENAI_API_KEY,
            maxInputTokens: 1000000,
        };
    }
    if (settings.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true") {
        return {
            dimensions: 1024,
            model: settings.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large",
            provider: "Ollama",
            endpoint: "https://ollama.eliza.ai/",
            apiKey: settings.OLLAMA_API_KEY,
            maxInputTokens: 1000000,
        };
    }
    if (settings.USE_GAIANET_EMBEDDING?.toLowerCase() === "true") {
        return {
            dimensions: 768,
            model: settings.GAIANET_EMBEDDING_MODEL || "nomic-embed",
            provider: "GaiaNet",
            endpoint: settings.SMALL_GAIANET_SERVER_URL || settings.MEDIUM_GAIANET_SERVER_URL || settings.LARGE_GAIANET_SERVER_URL,
            apiKey: settings.GAIANET_API_KEY,
            maxInputTokens: 1000000,
        };
    }
    if (settings.USE_VOYAGEAI_EMBEDDING?.toLowerCase() === "true") {
        return getVoyageAIEmbeddingConfig();
    }

    // Fallback to local BGE
    return {
        dimensions: 384,
        model: "BGE-small-en-v1.5",
        provider: "BGE",
        maxInputTokens: 1000000,
    };
};

async function getRemoteEmbedding(
    input: string,
    options: EmbeddingConfig
): Promise<number[]> {
    elizaLogger.debug("Getting remote embedding using provider:", options.provider);

    // Construct full URL
    const fullUrl = `${options.endpoint}/embeddings`;

    // jank. voyageai is the only one that doesn't use "dimensions".
    const body = options.provider === "VoyageAI" ? {
        input,
        model: options.model,
        output_dimension: options.dimensions,
    } : {
        input,
        model: options.model,
        dimensions: options.dimensions,
    };

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
        body: JSON.stringify(body),
    };

    try {
        const response = await fetch(fullUrl, requestOptions);

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
    const isLocal =
        isNode &&
        runtime.character.modelProvider !== ModelProviderName.OPENAI &&
        runtime.character.modelProvider !== ModelProviderName.GAIANET &&
        runtime.character.modelProvider !== ModelProviderName.HEURIST &&
        !settings.USE_OPENAI_EMBEDDING;

    return isLocal ? "local" : "remote";
}

export function getEmbeddingZeroVector(): number[] {
    // Default BGE dimension is 384
    return Array(getEmbeddingConfig().dimensions).fill(0);
}

/**
 * Gets embeddings from a remote API endpoint.  Falls back to local BGE/384
 *
 * @param {string} input - The text to generate embeddings for
 * @param {IAgentRuntime} runtime - The agent runtime context
 * @returns {Promise<number[]>} Array of embedding values
 * @throws {Error} If the API request fails or configuration is invalid
 */
export async function embed(runtime: IAgentRuntime, input: string) {
    elizaLogger.debug("Embedding request:", {
        modelProvider: runtime.character.modelProvider,
        useOpenAI: process.env.USE_OPENAI_EMBEDDING,
        input: input?.slice(0, 50) + "...",
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

    const config = getEmbeddingConfig();
    const isNode = typeof process !== "undefined" && process.versions?.node;

    // Attempt remote embedding if it is configured.
    if (config.provider !== EmbeddingProvider.BGE) {
        return await getRemoteEmbedding(input, config);
    }

    // Determine which embedding path to use
    if (config.provider === EmbeddingProvider.OpenAI) {
        return await getRemoteEmbedding(input, {
            model: config.model,
            endpoint: settings.OPENAI_API_URL || "https://api.openai.com/v1",
            apiKey: settings.OPENAI_API_KEY,
            dimensions: config.dimensions,
        });
    }

    if (config.provider === EmbeddingProvider.Ollama) {
        return await getRemoteEmbedding(input, {
            model: config.model,
            endpoint:
                runtime.character.modelEndpointOverride ||
                getEndpoint(ModelProviderName.OLLAMA),
            isOllama: true,
            dimensions: config.dimensions,
        });
    }

    if (config.provider == EmbeddingProvider.GaiaNet) {
        return await getRemoteEmbedding(input, {
            model: config.model,
            endpoint:
                runtime.character.modelEndpointOverride ||
                getEndpoint(ModelProviderName.GAIANET) ||
                settings.SMALL_GAIANET_SERVER_URL ||
                settings.MEDIUM_GAIANET_SERVER_URL ||
                settings.LARGE_GAIANET_SERVER_URL,
            apiKey: settings.GAIANET_API_KEY || runtime.token,
            dimensions: config.dimensions,
        });
    }

    if (config.provider === EmbeddingProvider.Heurist) {
        return await getRemoteEmbedding(input, {
            model: config.model,
            endpoint: getEndpoint(ModelProviderName.HEURIST),
            apiKey: runtime.token,
            dimensions: config.dimensions,
        });
    }

    // BGE - try local first if in Node
    if (isNode) {
        try {
            return await getLocalEmbedding(input);
        } catch (error) {
            elizaLogger.warn(
                "Local embedding failed, falling back to remote",
                error
            );
        }
    }

    // Fallback to remote override
    return await getRemoteEmbedding(input, {
        model: config.model,
        endpoint:
            runtime.character.modelEndpointOverride ||
            getEndpoint(runtime.character.modelProvider),
        apiKey: runtime.token,
        dimensions: config.dimensions,
        provider: config.provider,
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
