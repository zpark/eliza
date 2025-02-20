import type { TeeVendor, TeeVendorConfig } from './types';
import { marlinRemoteAttestationAction as remoteAttestationAction } from '../actions/remoteAttestationAction';
import { TeeVendors } from '@elizaos/core';



export class MarlinVendor implements TeeVendor {
    type = TeeVendors.MARLIN;

    getActions() {
        return [
            remoteAttestationAction,
        ];
    }
    getProviders() {
        return [];
    }

    getName() {
        return 'marlin-tee-plugin';
    }

    getDescription() {
        return 'Marlin TEE to Host Eliza Agents';
    }
} 