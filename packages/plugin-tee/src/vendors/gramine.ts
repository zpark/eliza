import { TeeType } from '../types';
import type { TeeVendor } from './types';
import { sgxAttestationProvider } from '../providers/remoteAttestationProvider';
import { TeeVendors } from '@elizaos/core';

export class GramineVendor implements TeeVendor {
    type = TeeVendors.SGX_GRAMINE;

    getActions() {
        return [];
    }

    getProviders() {
        return [sgxAttestationProvider];
    }

    getName() {
        return 'sgx-gramine-plugin';
    }

    getDescription() {
        return 'SGX Gramine TEE to Host Eliza Agents';
    }
}
