import { TeeVendorNames } from './types';
import type { TeeVendor } from './types';

export class FleekVendor implements TeeVendor {
    type = TeeVendorNames.FLEEK;

    getActions() {
        return [];
    }

    getProviders() {
        return [];
    }

    getName() {
        return 'fleek-tee-plugin';
    }

    getDescription() {
        return 'Fleek TEE to Host Eliza Agents';
    }
}
