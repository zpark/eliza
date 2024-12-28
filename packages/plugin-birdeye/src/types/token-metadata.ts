// Define explicit interface instead of using typeof
export interface TokenMetadataResponse {
    data: {
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
    };
    success: boolean;
}
