import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";

const STRATEGY_ADDRESSES = {
    YAK: "0x0C4684086914D5B1525bf16c62a0FF8010AB991A", // Yield Yak YAK
    USDC: "0xFB692D03BBEA21D8665035779dd3082c2B1622d0", // Benqi USDC
    gmYAK: "0x9db213cE52155A9462A869Af495234e4734DC08a", // Token Mill gmYAK
    JOE: "0x714e06410B4960D3C1FC033bCd53ad9EB2d1f874", // sJOE
}

const strategiesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        console.log("strategiesProvider::get")
        const strategies = Object.entries(STRATEGY_ADDRESSES).map(([key, value]) => `${key}: ${value}`).join("\n");
        return `The available strategy addresses and their deposit tokens are:\n${strategies}`;
    }
}

export { strategiesProvider };