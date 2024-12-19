import { elizaLogger, IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const jeeterEnvSchema = z.object({
    SIMSAI_DRY_RUN: z.string().transform((val) => val.toLowerCase() === "true"),
    SIMSAI_USERNAME: z.string().min(1, "Jeeter username is required"),
    SIMSAI_COOKIES: z.string().optional(),
    SIMSAI_AGENT_ID: z.string().optional(),
    SIMSAI_API_KEY: z.string().optional(),
});

export type JeeterConfig = z.infer<typeof jeeterEnvSchema>;

export async function validateJeeterConfig(
    runtime: IAgentRuntime
): Promise<JeeterConfig> {
    try {
        const config = {
            SIMSAI_DRY_RUN:
                runtime.getSetting("SIMSAI_DRY_RUN") ||
                process.env.SIMSAI_DRY_RUN,
            SIMSAI_USERNAME:
                runtime.getSetting("SIMSAI_USERNAME") ||
                process.env.SIMSAI_USERNAME,
            SIMSAI_AGENT_ID:
                runtime.getSetting("SIMSAI_AGENT_ID") ||
                process.env.SIMSAI_AGENT_ID,
            SIMSAI_COOKIES:
                runtime.getSetting("SIMSAI_COOKIES") ||
                process.env.SIMSAI_COOKIES,
            SIMSAI_API_KEY:
                runtime.getSetting("SIMSAI_API_KEY") ||
                process.env.SIMSAI_API_KEY,
        };

        return jeeterEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Twitter configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
