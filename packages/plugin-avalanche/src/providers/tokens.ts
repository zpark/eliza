import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";

const TOKEN_ADDRESSES = {
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    YAK: "0x59414b3089ce2AF0010e7523Dea7E2b35d776ec7",
    gmYAK: "0x3A30784c1af928CdFce678eE49370220aA716DC3",
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    JOE: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
    AUSD: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    PRINCESS: "0xB310Ed3A7F4Ae79E59dCa99784b312c2D19fFC7C",
}

const tokensProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        console.log("tokensProvider::get")
        const tokens = Object.entries(TOKEN_ADDRESSES).map(([key, value]) => `${key}: ${value}`).join("\n");
        return `The available tokens and their addresses are:\n${tokens}`;
    }
}

export { tokensProvider };