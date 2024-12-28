import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { STRATEGY_ADDRESSES } from "../utils/constants";

const strategiesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        console.log("strategiesProvider::get");
        const strategies = Object.entries(STRATEGY_ADDRESSES)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        return `The available strategy addresses and their deposit tokens are:\n${strategies}`;
    },
};

export { strategiesProvider };
