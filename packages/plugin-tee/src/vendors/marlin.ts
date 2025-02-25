import { TeeVendors } from '@elizaos/core';
import { marlinRemoteAttestationAction as remoteAttestationAction } from '../actions/remoteAttestationAction';
import type { TeeVendor } from './types';

export class MarlinVendor implements TeeVendor {
    type = TeeVendors.MARLIN;

    getActions() {
        return [remoteAttestationAction];
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
