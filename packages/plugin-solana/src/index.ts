import type { Plugin } from '@elizaos/core';
import { executeSwap } from './actions/swap.ts';
import transferToken from './actions/transfer.ts';
import { walletProvider } from './providers/wallet.ts';
import { SolanaClientInterface } from './client.ts';

export const solanaPlugin: Plugin = {
    name: 'SolanaPlugin',
    description: 'Solana Plugin for Eliza',
    actions: [transferToken, executeSwap],
    evaluators: [],
    providers: [walletProvider],
    clients: [SolanaClientInterface],
};
export default solanaPlugin;
