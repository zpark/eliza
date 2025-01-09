import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";
import { API_URLS } from "./constants";

export const coingeckoEnvSchema = z.object({
    COINGECKO_API_KEY: z.string().min(1, "CoinGecko API key is required"),
    COINGECKO_PRO_API_KEY: z.string().optional().nullable(),
});

export type CoingeckoConfig = z.infer<typeof coingeckoEnvSchema>;

export async function validateCoingeckoConfig(
    runtime: IAgentRuntime
): Promise<CoingeckoConfig> {
    try {
        const config = {
            COINGECKO_API_KEY: runtime.getSetting("COINGECKO_API_KEY"),
            COINGECKO_PRO_API_KEY: runtime.getSetting("COINGECKO_PRO_API_KEY") || null,
        };

        return coingeckoEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `CoinGecko configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}

export function getApiConfig(config: CoingeckoConfig) {
    if (config.COINGECKO_PRO_API_KEY) {
        return {
            baseUrl: API_URLS.PRO,
            apiKey: config.COINGECKO_PRO_API_KEY,
            headerKey: 'x-cg-pro-api-key'
        };
    }
    return {
        baseUrl: API_URLS.FREE,
        apiKey: config.COINGECKO_API_KEY,
        headerKey: 'x-cg-demo-api-key'
    };
}
