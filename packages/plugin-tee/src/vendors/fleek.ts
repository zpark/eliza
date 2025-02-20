import { TeeVendors } from "@elizaos/core";
import { TeeVendor } from "./types";

export class FleekVendor implements TeeVendor {
    type = TeeVendors.FLEEK;

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