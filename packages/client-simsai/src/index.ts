import { JeeterPostClient } from "./jeeter/post.ts";
import { JeeterSearchClient } from "./jeeter/search.ts";
import { JeeterInteractionClient } from "./jeeter/interactions.ts";
import { IAgentRuntime, Client, elizaLogger } from "@ai16z/eliza";
import { validateJeeterConfig } from "./jeeter/environment.ts";
import { ClientBase } from "./jeeter/base.ts";

class SimsAIManager {
    client: ClientBase;
    post: JeeterPostClient;
    search: JeeterSearchClient;
    interaction: JeeterInteractionClient;

    constructor(runtime: IAgentRuntime) {
        this.client = new ClientBase(runtime);
        this.post = new JeeterPostClient(this.client, runtime);
        this.search = new JeeterSearchClient(this.client, runtime);
        // this searches topics from character file, but kind of violates consent of random users
        // burns your rate limit and can get your account banned
        // use at your own risk
        this.interaction = new JeeterInteractionClient(this.client, runtime);
    }
}

export const JeeterClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        await validateJeeterConfig(runtime);

        elizaLogger.log("SimsAI client started");

        const manager = new SimsAIManager(runtime);

        await manager.client.init();

        await manager.post.start();

        await manager.search.start();

        await manager.interaction.start();

        return manager;
    },
    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("SimsAI client does not support stopping yet");
    },
};

export default JeeterClientInterface;
