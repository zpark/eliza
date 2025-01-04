// services/BinanceService.ts
import { Spot } from "@binance/connector";
import { elizaLogger } from "@elizaos/core";
import {
    BalanceCheckRequest,
    BalanceResponse,
    BinanceConfig,
    BinanceError,
    PriceCheckRequest,
    PriceResponse,
    SpotTradeRequest,
    TradeResponse,
} from "../types";

export class BinanceService {
    private client: Spot;

    constructor(config?: BinanceConfig) {
        this.client = new Spot(config?.apiKey, config?.secretKey, {
            baseURL: config?.baseURL,
        });
    }

    /**
     * Get current price for a symbol
     */
    async getPrice(request: PriceCheckRequest): Promise<PriceResponse> {
        try {
            const symbol = `${request.symbol}${request.quoteCurrency}`;
            const response = await this.client.tickerPrice(symbol);

            return {
                symbol,
                price: response.data.price,
                timestamp: Date.now(),
            };
        } catch (error) {
            throw new BinanceError(
                `Failed to fetch price for ${request.symbol}`,
                error.code,
                error
            );
        }
    }

    /**
     * Execute a spot trade
     */
    async executeTrade(request: SpotTradeRequest): Promise<TradeResponse> {
        let minNotional: string | undefined;
        try {
            // Always check if the symbol is valid first
            const exchangeInfo = await this.client.exchangeInfo();
            const symbolInfo = exchangeInfo.data.symbols.find(
                (s: any) => s.symbol === request.symbol
            );

            if (!symbolInfo) {
                throw new Error(
                    `Trading pair ${request.symbol} is not available`
                );
            }

            // Get minimum notional value from symbol filters
            minNotional = symbolInfo.filters.find(
                (f: any) => f.filterType === "NOTIONAL"
            )?.minNotional;

            const orderParams = this.buildOrderParams(request);

            const response = await this.client.newOrder(
                orderParams.symbol,
                orderParams.side,
                orderParams.type,
                orderParams
            );

            return {
                symbol: response.data.symbol,
                orderId: response.data.orderId,
                status: response.data.status,
                executedQty: response.data.executedQty,
                cummulativeQuoteQty: response.data.cummulativeQuoteQty,
                price: response.data.price,
                type: response.data.type,
                side: response.data.side,
            };
        } catch (error) {
            // Log the error details
            elizaLogger.error("Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: error.config,
            });

            if (error.response?.status === 401) {
                throw new Error(
                    "Invalid API credentials. Please check your API key and secret."
                );
            }
            if (
                error.response?.data?.code === -1013 &&
                error.response?.data?.msg?.includes("NOTIONAL")
            ) {
                const minNotionalMsg = minNotional
                    ? ` Minimum order value is ${minNotional} USDC.`
                    : "";
                throw new Error(
                    `Order value is too small. Please increase the quantity to meet the minimum order value requirement.${minNotionalMsg}`
                );
            }
            throw new Error(error.response?.data?.msg || error.message);
        }
    }

    private buildOrderParams(
        request: SpotTradeRequest
    ): SpotTradeRequest & Record<string, unknown> {
        const params: SpotTradeRequest & Record<string, unknown> = {
            ...request,
            symbol: request.symbol.toUpperCase(),
        };

        if (request.type === "LIMIT") {
            if (!request.price) {
                throw new BinanceError("Price is required for LIMIT orders");
            }
            params.timeInForce = request.timeInForce || "GTC";
        }

        return params;
    }

    /**
     * Format price for display
     */
    static formatPrice(price: number | string): string {
        const numPrice = typeof price === "string" ? parseFloat(price) : price;
        return new Intl.NumberFormat("en-US", {
            style: "decimal",
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
        }).format(numPrice);
    }

    /**
     * Get account balance for all assets or a specific asset
     */
    async getBalance(request: BalanceCheckRequest): Promise<BalanceResponse> {
        try {
            const response = await this.client.account();
            let balances = response.data.balances.filter(
                (balance: { free: string; locked: string }) =>
                    parseFloat(balance.free) > 0 ||
                    parseFloat(balance.locked) > 0
            );

            if (request.asset) {
                balances = balances.filter(
                    (b: { asset: string }) =>
                        b.asset.toUpperCase() === request.asset.toUpperCase()
                );
            }

            return {
                balances,
                timestamp: Date.now(),
            };
        } catch (error) {
            if (error.response?.status === 401) {
                throw new BinanceError("Invalid API credentials", 401);
            }
            throw new BinanceError(
                request.asset
                    ? `Failed to fetch balance for ${request.asset}`
                    : "Failed to fetch account balances",
                error.response?.status || error.code
            );
        }
    }
}
