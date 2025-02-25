import logger from "./logger.ts";
import type { IAgentRuntime, State, Memory } from "./types.ts";

/**
 * Formats provider outputs into a string which can be injected into the context.
 * @param runtime The AgentRuntime object.
 * @param message The incoming message object.
 * @param state The current state object.
 * @returns A string that concatenates the outputs of each provider.
 */
export async function getProviders(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
) {
    const providerResults = (
        await Promise.all(
            runtime.providers.map(async (provider) => {
                const start = Date.now();
                const result = await provider.get(runtime, message, state);
                const duration = Date.now() - start;
                logger.warn(`Provider took ${duration}ms to respond`);
                return result;
            })
        )
    ).filter((result) => result != null && result !== "");

    return providerResults.join("\n\n");
}
