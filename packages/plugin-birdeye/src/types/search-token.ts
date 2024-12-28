export interface SearchToken {
    address: string;
    name: string;
    symbol: string;
    price: number;
    fdv: number;
    market_cap: number;
    liquidity: number;
    volume_24h_usd: number;
    volume_24h_change_percent: number;
    price_change_24h_percent: number;
    network: string;
    buy_24h: number;
    buy_24h_change_percent: number;
    sell_24h: number;
    sell_24h_change_percent: number;
    trade_24h: number;
    trade_24h_change_percent: number;
    unique_wallet_24h: number;
    unique_view_24h_change_percent: number;
    last_trade_human_time: string;
    last_trade_unix_time: number;
    logo_uri: string;
    verified: boolean;
}

export interface SearchTokenResponse {
    data: {
        items: Array<{
            type: string;
            result: SearchToken[];
        }>;
    };
    success: boolean;
}

export interface SearchTokensOptions {
    keyword: string;
    chain?: string;
    limit?: number;
    offset?: number;
    type?: "address" | "symbol";
}
