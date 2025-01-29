import { z } from "zod";

// Base configuration types
export interface DeskExchangeConfig {
    privateKey: string;
    network?: "mainnet" | "testnet";
    walletAddress?: string;
}

export const PlaceOrderSchema = z.object({
    symbol: z.string().min(1).toUpperCase(),
    side: z.enum(["Long", "Short"]),
    amount: z.number({ coerce: true }).positive(),
    price: z.number({ coerce: true }),
    nonce: z.string(),
    broker_id: z.enum(["DESK"]),
    order_type: z.enum(["Market", "Limit"]),
    reduce_only: z.boolean(),
    subaccount: z.string(),
    timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderSchema>;

// Error handling types
export class DeskExchangeError extends Error {
    constructor(
        message: string,
        public code?: number,
        public details?: unknown
    ) {
        super(message);
        this.name = "DeskExchangeError";
    }
}