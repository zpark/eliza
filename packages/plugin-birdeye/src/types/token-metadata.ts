export interface TokenMetadataResponse {
    data: TokenMetadataItem;
    success: boolean;
}

export interface TokenMetadataItem {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    extensions: {
        coingecko_id?: string;
        website?: string;
        twitter?: string;
        discord?: string;
        medium?: string;
    };
    logo_uri?: string;
}
