import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { TOKEN_ADDRESSES } from "../utils/constants";

const tokensProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        console.log("tokensProvider::get");
        const tokens = Object.entries(TOKEN_ADDRESSES)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        return `The available tokens and their addresses are:\n${tokens}`;
    },
};

export { tokensProvider };
