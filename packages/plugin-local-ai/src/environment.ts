import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";
import { logger } from "@elizaos/core";

// Configuration schema with text model source flags
export const configSchema = z.object({
    USE_LOCAL_AI: z.boolean().default(true),
    USE_STUDIOLM_TEXT_MODELS: z.boolean().default(false),
    USE_OLLAMA_TEXT_MODELS: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

function validateModelConfig(config: Record<string, boolean>): void {
    // Log raw values before validation
    logger.info("Validating model configuration with values:", {
        USE_LOCAL_AI: config.USE_LOCAL_AI,
        USE_STUDIOLM_TEXT_MODELS: config.USE_STUDIOLM_TEXT_MODELS,
        USE_OLLAMA_TEXT_MODELS: config.USE_OLLAMA_TEXT_MODELS
    });

    // Ensure USE_LOCAL_AI is always true
    if (!config.USE_LOCAL_AI) {
        config.USE_LOCAL_AI = true;
        logger.info("Setting USE_LOCAL_AI to true as it's required");
    }

    // Only validate that StudioLM and Ollama are not both enabled
    if (config.USE_STUDIOLM_TEXT_MODELS && config.USE_OLLAMA_TEXT_MODELS) {
        throw new Error("StudioLM and Ollama text models cannot be enabled simultaneously");
    }

    logger.info("Configuration is valid");
}

export async function validateConfig(
    config: Record<string, string>
): Promise<Config> {
    try {
        // Log raw environment variables
        logger.info("Raw environment variables:", {
            USE_LOCAL_AI: process.env.USE_LOCAL_AI,
            USE_STUDIOLM_TEXT_MODELS: process.env.USE_STUDIOLM_TEXT_MODELS,
            USE_OLLAMA_TEXT_MODELS: process.env.USE_OLLAMA_TEXT_MODELS
        });

        // Parse environment variables with proper boolean conversion
        const booleanConfig = {
            USE_LOCAL_AI: true, // Always true
            USE_STUDIOLM_TEXT_MODELS: config.USE_STUDIOLM_TEXT_MODELS === 'true',
            USE_OLLAMA_TEXT_MODELS: config.USE_OLLAMA_TEXT_MODELS === 'true',
        };

        logger.info("Parsed boolean configuration:", booleanConfig);

        // Validate text model source configuration
        validateModelConfig(booleanConfig);

        const validatedConfig = configSchema.parse(booleanConfig);
        
        logger.info("Final validated configuration:", validatedConfig);
        
        return validatedConfig;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            logger.error("Zod validation failed:", errorMessages);
            throw new Error(
                `Configuration validation failed:\n${errorMessages}`
            );
        }
        logger.error("Configuration validation failed:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
} 