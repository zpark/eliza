import { z } from "zod";

// Base configuration types
export interface DeskExchangeConfig {
    privateKey: string;
    network?: "mainnet" | "testnet";
    walletAddress?: string;
}

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