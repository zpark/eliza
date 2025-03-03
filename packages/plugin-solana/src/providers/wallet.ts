import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import BigNumber from 'bignumber.js';
import type { WalletPortfolio } from '../types';
import { SOLANA_WALLET_DATA_CACHE_KEY } from '../constants';

export const walletProvider: Provider = {
    name: "solana-wallet",
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State,
    ): Promise<string | null> => {
        try {
            const portfolioCache = await runtime.databaseAdapter.getCache<WalletPortfolio>(
                SOLANA_WALLET_DATA_CACHE_KEY,
            );
            if (!portfolioCache) {
                return null;
            }

            const portfolio = portfolioCache;

            const agentName = state?.agentName || 'The agent';
            let output = `${agentName}'s Solana Wallet\n`;
            output += `Total Value: $${new BigNumber(portfolio.totalUsd).toFixed(2)} (${
                portfolio.totalSol
            } SOL)\n\n`;

            // Token Balances
            output += 'Token Balances:\n';
            const nonZeroItems = portfolio.items.filter((item) =>
                new BigNumber(item.uiAmount).isGreaterThan(0),
            );

            if (nonZeroItems.length === 0) {
                output += 'No tokens found with non-zero balance\n';
            } else {
                for (const item of nonZeroItems) {
                    const valueUsd = new BigNumber(item.valueUsd).toFixed(2);
                    output += `${item.name} (${item.symbol}): ${new BigNumber(
                        item.uiAmount,
                    ).toFixed(6)} ($${valueUsd} | ${item.valueSol} SOL)\n`;
                }
            }

            // Market Prices
            if (portfolio.prices) {
                output += '\nMarket Prices:\n';
                output += `SOL: $${new BigNumber(portfolio.prices.solana.usd).toFixed(2)}\n`;
                output += `BTC: $${new BigNumber(portfolio.prices.bitcoin.usd).toFixed(2)}\n`;
                output += `ETH: $${new BigNumber(portfolio.prices.ethereum.usd).toFixed(2)}\n`;
            }

            return output;
        } catch (error) {
            console.error('Error in Solana wallet provider:', error);
            return null;
        }
    },
};
