import { IAgentRuntime } from "@ai16z/eliza";
import {
    convertBaseUnitToDisplayUnit,
    getSymbolByDenom,
} from "@chain-registry/utils";
import { assets } from "chain-registry";
import { initWalletChainsData } from "./utils";

export const cosmosWalletProvider = {
    get: async (runtime: IAgentRuntime) => {
        let providerContextMessage = "";

        try {
            const provider = await initWalletChainsData(runtime);

            for (const [chainName, chainData] of Object.entries(
                provider.chainsData
            )) {
                const address = await chainData.wallet.getWalletAddress();
                const balances = await chainData.wallet.getWalletBalances();

                const convertedCoinsToDisplayDenom = balances.map((balance) => {
                    const symbol = getSymbolByDenom(
                        assets,
                        balance.denom,
                        chainName
                    );

                    return {
                        amount: symbol
                            ? convertBaseUnitToDisplayUnit(
                                  assets,
                                  symbol,
                                  balance.amount,
                                  chainName
                              )
                            : balance.amount,
                        symbol: symbol ?? balance.denom,
                    };
                });

                const balancesToString = convertedCoinsToDisplayDenom
                    .map((balance) => `- ${balance.amount} ${balance.symbol}`)
                    .join("\n");

                providerContextMessage += `Chain: ${chainName}\nAddress: ${address}\nBalances:\n${balancesToString}\n________________\n`;
            }

            return providerContextMessage;
        } catch (error) {
            console.error(
                "Error Initializing in Cosmos wallet provider:",
                error
            );

            return null;
        }
    },
};
