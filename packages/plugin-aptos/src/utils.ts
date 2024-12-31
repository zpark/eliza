export function isMovementNetwork(network: string): boolean {
    return network.startsWith('movement_');
}

export function getMovementNetworkType(network: string): 'MAINNET' | 'TESTNET' {
    return network === 'movement_mainnet' ? 'MAINNET' : 'TESTNET';
}

export function getTokenSymbol(network: string): string {
    return network.startsWith('movement_') ? 'MOVE' : 'APT';
}