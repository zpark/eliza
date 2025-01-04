import axios from "axios";
import { ApiResponse, PriceData } from "./types";

const COINMARKETCAP_BASE_URL = "https://pro-api.coinmarketcap.com/v1";
const COINCAP_BASE_URL = "https://api.coincap.io/v2";

export const createPriceService = (apiKey?: string) => {
    const coinmarketcapClient = apiKey ? axios.create({
        baseURL: COINMARKETCAP_BASE_URL,
        headers: {
            "X-CMC_PRO_API_KEY": apiKey,
            Accept: "application/json",
        },
    }) : null;

    const coincapClient = axios.create({
        baseURL: COINCAP_BASE_URL,
        headers: {
            Accept: "application/json",
        },
    });

    const getPrice = async (
        symbol: string,
        currency: string,
        cryptoName: string,
    ): Promise<PriceData> => {
        const normalizedCrypto = cryptoName.toLowerCase().trim();
        const normalizedSymbol = symbol.toUpperCase().trim();
        const normalizedCurrency = currency.toUpperCase().trim();

        try {
            if (coinmarketcapClient) {
                // Try CoinMarketCap first if API key is available
                const response = await coinmarketcapClient.get<ApiResponse>(
                    "/cryptocurrency/quotes/latest",
                    {
                        params: {
                            symbol: normalizedSymbol,
                            convert: normalizedCurrency,
                        },
                    }
                );

                const symbolData = response.data.data[normalizedSymbol];
                if (!symbolData) {
                    throw new Error(
                        `No data found for symbol: ${normalizedSymbol}`
                    );
                }

                const quoteData = symbolData.quote[normalizedCurrency];
                if (!quoteData) {
                    throw new Error(
                        `No quote data found for currency: ${normalizedCurrency}`
                    );
                }

                return {
                    price: quoteData.price,
                    marketCap: quoteData.market_cap,
                    volume24h: quoteData.volume_24h,
                    percentChange24h: quoteData.percent_change_24h,
                };
            } else {
                // Fallback to CoinCap API
                // CoinCap only supports USD, so we'll need to handle currency conversion differently
                if (normalizedCurrency !== "USD") {
                    throw new Error("CoinCap API only supports USD currency");
                }

                const response = await coincapClient.get(`/assets/${normalizedCrypto}`);
                const data = response.data.data;

                if (!data) {
                    throw new Error(`No data found for cryptocurrency: ${normalizedCrypto}`);
                }

                return {
                    price: parseFloat(data.priceUsd),
                    marketCap: parseFloat(data.marketCapUsd),
                    volume24h: parseFloat(data.volumeUsd24Hr),
                    percentChange24h: parseFloat(data.changePercent24Hr),
                };
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorMessage =
                    error.response?.data?.status?.error_message ||
                    error.response?.data?.error ||
                    error.message;
                console.error("API Error:", errorMessage);
                throw new Error(`API Error: ${errorMessage}`);
            }
            throw error;
        }
    };

    return { getPrice };
}
