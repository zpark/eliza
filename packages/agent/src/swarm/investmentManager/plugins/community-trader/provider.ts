import { IAgentRuntime, Memory, State } from "@elizaos/core";
import { dataProvider } from "./providers/data";
import { recommendationsProvider } from "./providers/recommendations";
import { render } from "./utils";
import template from "./prompts/trust-plugin-provider.md";

const providers = [dataProvider, recommendationsProvider];

export const trustProvider = {
    async get(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> {
        const [data, recommendations] = await Promise.all(
            providers.map((provider) => provider.get(runtime, message, state))
        );

        return render(template, {
            providers: [recommendations, data].join("\n"),
        });
    },
};
