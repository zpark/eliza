import { ClientInstance, logger, UUID, type Client, type IAgentRuntime, type Plugin } from "@elizaos/core";
import reply from "./actions/reply.ts";
import { ClientBase } from "./base.ts";
import { TWITTER_CLIENT_NAME } from "./constants.ts";
import { validateTwitterConfig, type TwitterConfig } from "./environment.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import { TwitterPostClient } from "./post.ts";
import { TwitterSpaceClient } from "./spaces.ts";
import { ITwitterClient } from "./types.ts";

/**
 * A manager that orchestrates all specialized Twitter logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing Twitter Spaces (optional)
 */
export class TwitterClient implements ITwitterClient {
    name: string = "twitter";
    client: ClientBase;
    post: TwitterPostClient;
    interaction: TwitterInteractionClient;
    space?: TwitterSpaceClient;

    constructor(runtime: IAgentRuntime, twitterConfig: TwitterConfig) {
        // Pass twitterConfig to the base client
        this.client = new ClientBase(runtime, twitterConfig);

        // Posting logic
        this.post = new TwitterPostClient(this.client, runtime);

        // Mentions and interactions
        this.interaction = new TwitterInteractionClient(this.client, runtime);

        // Optional Spaces logic (enabled if TWITTER_SPACES_ENABLE is true)
        if (twitterConfig.TWITTER_SPACES_ENABLE) {
            this.space = new TwitterSpaceClient(this.client, runtime);
        }
    }

    async stop() {
        logger.warn("Twitter client does not support stopping yet");
    }
}

export class TwitterClientManager {
    private static instance: TwitterClientManager;
    private clients: Map<string, TwitterClient> = new Map();
    
    private constructor() {}

    static getInstance(): TwitterClientManager {
        if (!TwitterClientManager.instance) {
            TwitterClientManager.instance = new TwitterClientManager();
        }
        return TwitterClientManager.instance;
    }

    async createClient(runtime: IAgentRuntime, clientId: string, config: TwitterConfig): Promise<TwitterClient> {
        console.log("Creating client", clientId, config);
        // if TWITTER_2FA_SECRET === null, delete it
        if (config.TWITTER_2FA_SECRET === null) {
            delete config.TWITTER_2FA_SECRET;
        }
        try {
            // Check if client already exists
            const existingClient = this.getClient(clientId, runtime.agentId);
            if (existingClient) {
                logger.info(`Twitter client already exists for ${clientId}`);
                return existingClient;
            }

            // Validate the configuration
            const validatedConfig = await validateTwitterConfig(runtime, config);

            // Create new client instance
            const client = new TwitterClient(runtime, validatedConfig);
            
            // Initialize the client
            await client.client.init();

            // Store the client instance
            this.clients.set(this.getClientKey(clientId, runtime.agentId), client);

            logger.info(`Created Twitter client for ${clientId}`);
            return client;

        } catch (error) {
            logger.error(`Failed to create Twitter client for ${clientId}:`, error);
            throw error;
        }
    }

    getClient(clientId: string, agentId: UUID): TwitterClient | undefined {
        return this.clients.get(this.getClientKey(clientId, agentId));
    }

    async stopClient(clientId: string, agentId: UUID): Promise<void> {
        const key = this.getClientKey(clientId, agentId);
        const client = this.clients.get(key);
        if (client) {
            try {
                await client.stop();
                this.clients.delete(key);
                logger.info(`Stopped Twitter client for ${clientId}`);
            } catch (error) {
                logger.error(`Error stopping Twitter client for ${clientId}:`, error);
            }
        }
    }

    async stopAllClients(): Promise<void> {
        for (const [key, client] of this.clients.entries()) {
            try {
                await client.stop();
                this.clients.delete(key);
            } catch (error) {
                logger.error(`Error stopping Twitter client ${key}:`, error);
            }
        }
    }

    private getClientKey(clientId: string, agentId: UUID): string {
        return `${clientId}-${agentId}`;
    }
}

const TwitterClientInterface: Client = {
    name: TWITTER_CLIENT_NAME,
    start: async (runtime: IAgentRuntime) => {
        const manager = TwitterClientManager.getInstance();
        
        // Check for character-level Twitter credentials
        const twitterConfig: Partial<TwitterConfig> = {
            TWITTER_USERNAME: runtime.getSetting("TWITTER_USERNAME") as string,
            TWITTER_PASSWORD: runtime.getSetting("TWITTER_PASSWORD") as string,
            TWITTER_EMAIL: runtime.getSetting("TWITTER_EMAIL") as string,
            TWITTER_2FA_SECRET: runtime.getSetting("TWITTER_2FA_SECRET") as string,
        };

        // Filter out undefined values
        const config = Object.fromEntries(
            Object.entries(twitterConfig).filter(([_, v]) => v !== undefined)
        ) as TwitterConfig;

        // If we have enough settings to create a client, do so
        try {
            if (config.TWITTER_USERNAME && (
                // Basic auth
                (config.TWITTER_PASSWORD && config.TWITTER_EMAIL)
                // ||
                // // API auth
                // (config.TWITTER_API_KEY && config.TWITTER_API_SECRET && 
                //  config.TWITTER_ACCESS_TOKEN && config.TWITTER_ACCESS_TOKEN_SECRET)
            )) {
                logger.info("Creating default Twitter client from character settings");
                await manager.createClient(runtime, "default", config);
            }
        } catch (error) {
            logger.error("Failed to create default Twitter client:", error);
        }

        const clientInstance: ClientInstance = {
            async stop() {
                await manager.stopAllClients();
            }
        };
        return clientInstance;
    }
};

const twitterPlugin: Plugin = {
    name: "twitter",
    description: "Twitter client with per-server instance management",
    clients: [TwitterClientInterface],
    actions: [reply]
};

export default twitterPlugin;
