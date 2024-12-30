export const DEFAULT_MAX_RETRIES = 3;

export const DEFAULT_SUPPORTED_SYMBOLS = {
    SOL: "So11111111111111111111111111111111111111112",
    BTC: "qfnqNqs3nCAHjnyCgLRDbBtq4p2MtHZxw8YjSyYhPoL",
    ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    Example: "2weMjPLLybRMMva1fM3U31goWWrCpF59CHWNhnCJ9Vyh",
};

export const API_BASE_URL = "https://public-api.birdeye.so";
export const ENDPOINT_MAP = {
    price: "/defi/price?address=",
    security: "/defi/token_security?address=",
    volume: "/defi/v3/token/trade-data/single?address=",
    portfolio: "/v1/wallet/token_list?wallet=",
    tokens: "/defi/tokenlist",
};

export const RETRY_DELAY_MS = 2_000;
