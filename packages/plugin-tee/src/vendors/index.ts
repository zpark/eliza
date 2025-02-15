import type { TeeVendor } from './types';
import { PhalaVendor } from './phala';
import { GramineVendor } from './gramine';
import { TeeVendors } from '@elizaos/core';
import { MarlinVendor } from './marlin';
import { FleekVendor } from './fleek';

const vendors: Record<TeeVendors, TeeVendor> = {
    [TeeVendors.PHALA]: new PhalaVendor(),
    [TeeVendors.MARLIN]: new MarlinVendor(),
    [TeeVendors.FLEEK]: new FleekVendor(),
    [TeeVendors.SGX_GRAMINE]: new GramineVendor(),
};

export const getVendor = (type: TeeVendors): TeeVendor => {
    const vendor = vendors[type];
    if (!vendor) {
        throw new Error(`Unsupported TEE vendor type: ${type}`);
    }
    return vendor;
};

export * from './types'; 