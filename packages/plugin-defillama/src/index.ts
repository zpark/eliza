import { createPlugin } from "@elizaos/core";
import { getPriceAction } from "./actions/get-price.action";
import { DefiLlamaEnvironmentSchema } from "./environment";
import { DefiLlamaProvider } from "./providers/defillama.provider";

export const DefiLlamaPlugin = createPlugin({
    name: "defillama",
    version: "0.1.0",
    environment: DefiLlamaEnvironmentSchema,
    provider: ({ environment }) => new DefiLlamaProvider(environment),
    actions: [getPriceAction],
});

export * from "./environment";
