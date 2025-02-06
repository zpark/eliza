import { JeeterPostClient } from "./jeeter/post.ts";
import { JeeterSearchClient } from "./jeeter/search.ts";
import { JeeterInteractionClient } from "./jeeter/interactions.ts";
import { IAgentRuntime, Client, elizaLogger, type Plugin } from "@elizaos/core";
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
        this.interaction = new JeeterInteractionClient(this.client, runtime);
    }

    async stop() {
        elizaLogger.log("Stopping SimsAI client");
        await this.interaction.stop();
        await this.search.stop();
        await this.post.stop();
        elizaLogger.log("SimsAI client stopped successfully");
    }
}

const JeeterClientInterface: Client = {
    name: 'jeeter',
    async start(runtime: IAgentRuntime) {
        await validateJeeterConfig(runtime);

        elizaLogger.log("SimsAI client started");

        const activeManager = new SimsAIManager(runtime);

        await activeManager.client.init();

        await activeManager.post.start();

        await activeManager.search.start();

        await activeManager.interaction.start();

        return activeManager;
    },
};

const simsaiPlugin: Plugin = {
    name: "simsai",
    description: "SimsAI client plugin",
    clients: [JeeterClientInterface],
};
export default simsaiPlugin;