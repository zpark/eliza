import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { zerionProvider } from "../../providers/index.ts";
import { formatPortfolioData } from "../../utils.ts";
import examples from "./examples.ts";



export const getWalletPortfolio: Action = {
    name: "getwallet_portfolio",
    description: "Fetch a wallet's portfolio data from Zerion for an address",
    similes: [
        "getwallet_portfolio",
        "displayportfolio",
        "getwallet_holdings",
        "getwallet_balance",
        "getwallet_value",
        "get_portfolio_value",
        "get wallet portfolio",
        "get wallet holdings",
        "get wallet balance",
        "get wallet value",
    ],
    examples: examples,
    validate: async (runtime: IAgentRuntime, message: Memory) => {

        const addressRegex = /0x[a-fA-F0-9]{40}/;
        return addressRegex.test(message.content.text);
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: { [key: string]: unknown; }, callback?: HandlerCallback): Promise<boolean> => {
        // implement zerion provider here
        console.log("inside handler of zerion");
        const response = await zerionProvider.get(runtime, message);
        console.log("ZERION portfolioAPI response: ", response);
        if (!response.success || !response.data) {
            return false;
        }

        console.log("ZERION API response: ", response);

        // format response into a message string;
        const formattedResponse = formatPortfolioData(response.data);

        if (callback) {
            console.log("sending response to callback");
            callback({
                text: formattedResponse,
                content: {
                    ...response.data
                }
            })
        }
        return true;
    }


}