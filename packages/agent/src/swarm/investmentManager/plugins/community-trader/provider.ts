import { IAgentRuntime, Memory, State } from "@elizaos/core";
import { dataProvider } from "./providers/data";
import { recommendationsProvider } from "./providers/recommendations";
import { render } from "./utils";

const template = `<trust_plugin>

<documentation>
<!-- Trust Plugin Documentation -->
</documentation>

<instructions>

</instructions>

<providers>
{{providers}}
</providers>

</trust_plugin>
`

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
