// src/index.ts
import { type Client, type IAgentRuntime, elizaLogger, type Plugin } from "@elizaos/core";
import { validateInstagramConfig } from "./environment";
import { initializeClient } from "./lib/auth";
import { InstagramInteractionService } from "./services/interaction";
import { InstagramPostService } from "./services/post";

const InstagramClientInterface: Client = {
    name: 'instagram',
    async start(runtime: IAgentRuntime) {
        try {
            // Validate configuration
            const config = await validateInstagramConfig(runtime);
            elizaLogger.log("Instagram client configuration validated");

            // Initialize client and get initial state
            const state = await initializeClient(runtime, config);
            elizaLogger.log("Instagram client initialized");

            // Create services
            const postService = new InstagramPostService(runtime, state);
            const interactionService = new InstagramInteractionService(
                runtime,
                state
            );

            // Start services
            if (!config.INSTAGRAM_DRY_RUN) {
                await postService.start();
                elizaLogger.log("Instagram post service started");

                if (config.INSTAGRAM_ENABLE_ACTION_PROCESSING) {
                    await interactionService.start();
                    elizaLogger.log("Instagram interaction service started");
                }
            } else {
                elizaLogger.log("Instagram client running in dry-run mode");
            }

            // Return manager instance
            return {
                post: postService,
                interaction: interactionService,
                state,
                async stop() {
                    elizaLogger.log("Stopping Instagram client services...");
                },
            };
        } catch (error) {
            elizaLogger.error("Failed to start Instagram client:", error);
            throw error;
        }
    },
};

const instagramPlugin: Plugin = {
    name: "instagram",
    description: "Instagram client plugin",
    clients: [InstagramClientInterface],
};

export default instagramPlugin;