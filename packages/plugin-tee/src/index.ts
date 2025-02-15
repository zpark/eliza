import { type Plugin, TeeVendors, TeePluginConfig, TeeVendorConfig } from '@elizaos/core';
import { TeeLogService } from './services/teeLogService';
import { getVendor } from './vendors';

export { PhalaRemoteAttestationProvider } from './providers/remoteAttestationProvider';
export { PhalaDeriveKeyProvider } from './providers/deriveKeyProvider';
export { TeeLogService };
export type { TeeVendorConfig };

export const teePlugin = (config?: TeePluginConfig): Plugin => {
    const vendorType = config?.vendor || TeeVendors.PHALA;
    const vendor = getVendor(vendorType);
    
    return {
        name: vendor.getName(),
        description: vendor.getDescription(),
        actions: vendor.getActions(),
        evaluators: [],
        providers: vendor.getProviders(),
        services: [new TeeLogService()],
    };
};
