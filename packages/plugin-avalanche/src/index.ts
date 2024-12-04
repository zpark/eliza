import { Plugin } from "@ai16z/eliza";
import transfer from './actions/transfer'
import yakSwap from './actions/yakSwap'
import yakStrategy from './actions/yakStrategy'
import { tokensProvider } from './providers/tokens'
import { strategiesProvider } from './providers/strategies'
import { walletProvider } from './providers/wallet'
import { TOKEN_ADDRESSES, STRATEGY_ADDRESSES, YAK_SWAP_CONFIG } from './utils/constants'

export const PROVIDER_CONFIG = {
    TOKEN_ADDRESSES: TOKEN_ADDRESSES,
    STRATEGY_ADDRESSES: STRATEGY_ADDRESSES,
    YAK_SWAP_CONFIG: YAK_SWAP_CONFIG
}

export const avalanchePlugin: Plugin = {
    name: "avalanche",
    description: "Avalanche Plugin for Eliza",
    actions: [
        transfer,
        yakSwap,
        yakStrategy
    ],
    evaluators: [],
    providers: [
        tokensProvider,
        strategiesProvider,
        walletProvider,
    ],
};

export default avalanchePlugin;