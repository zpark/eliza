import routes from "./apis";
import { IAgentRuntime, Plugin } from "@elizaos/core";
import { registerTasks } from "./tasks";

// create a new plugin
export const intelPlugin: Plugin = {
	name: "intel",
    description: "Degen Intel plugin",
	routes,
	init: async (_, runtime: IAgentRuntime) => {
		await registerTasks(runtime);
	}
};
