import type { Action, Provider, TeeVendors } from '@elizaos/core';

export interface TeeVendor {
    type: TeeVendors;
    getActions(): Action[];
    getProviders(): Provider[];
    getName(): string;
    getDescription(): string;
}
