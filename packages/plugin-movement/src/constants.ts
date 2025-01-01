export const MOV_DECIMALS = 8;

export const MOVEMENT_NETWORKS = {
    mainnet: {
        fullnode: 'https://fullnode.mainnet.mov.network/v1',
        chainId: '1',
        name: 'Movement Mainnet'
    },
    bardock: {
        fullnode: 'https://fullnode.testnet.mov.network/v1',
        chainId: '2',
        name: 'Movement Bardock Testnet'
    }
} as const;

export const DEFAULT_NETWORK = 'bardock';