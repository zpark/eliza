import { type IAgentRuntime } from "@elizaos/core";
import { type OnboardingConfig } from "./types";

export async function initializeOnboarding(runtime: IAgentRuntime, serverId: string, config: OnboardingConfig): Promise<void> {
    try {
        // Store the config in cache if it doesn't exist
        const existingConfig = await runtime.cacheManager.get(
            `server_${serverId}_onboarding_config`
        );

        if (!existingConfig) {
            await runtime.cacheManager.set(
                `server_${serverId}_onboarding_config`,
                config
            );
        }

    } catch (error) {
        throw new Error(`Failed to initialize compliance officer onboarding: ${error}`);
    }
}