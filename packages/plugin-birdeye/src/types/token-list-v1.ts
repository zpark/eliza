export interface TokenListV1Item {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    liquidity: number;
    mc: number; // market cap
    v24hUSD: number;
    v24hChangePercent: number;
    lastTradeUnixTime: number;
    logoURI: string;
}

export interface TokenListV1Response {
    success: boolean;
    data: {
        updateUnixTime: number;
        updateTime: string;
        tokens: TokenListV1Item[];
        total: number;
    };
}

export interface TokenListV1Options {
    sort_by?: string;
    sort_type?: string;
    limit?: number;
    offset?: number;
    min_liquidity?: number;
}
