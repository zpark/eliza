export interface WalletDataResponse {
    data: {
        items: WalletDataItem[];
    };
    success: boolean;
}

export interface WalletDataItem {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    uiAmount: number;
    chainId: string;
    logoURI: string;
    priceUsd?: number;
    valueUsd?: number;
}

export interface WalletDataOptions {
    wallet: string;
    chain: string;
}
