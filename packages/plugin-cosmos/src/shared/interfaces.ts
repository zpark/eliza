export interface ICosmosActionService {
    execute: ((...params: unknown[]) => void) | (() => void);
}

export interface ICosmosTransaction {
    from: string;
    to: string;
    txHash: string;
    gasPaid: number;
}
