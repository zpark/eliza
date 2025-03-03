import type { Plugin } from '@elizaos/core';
import { executeSwap } from './actions/swap.ts';
import transferToken from './actions/transfer.ts';
import { walletProvider } from './providers/wallet.ts';
import { SolanaClient } from './client.ts';
import { SOLANA_CLIENT_NAME } from './constants.ts';

export const solanaPlugin: Plugin = {
    name: SOLANA_CLIENT_NAME,
    description: 'Solana Plugin for Eliza',
    actions: [transferToken, executeSwap],
    evaluators: [],
    providers: [walletProvider],
    clients: [SolanaClient],
};
export default solanaPlugin;
