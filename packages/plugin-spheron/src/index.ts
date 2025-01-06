import { Plugin } from "@elizaos/core";
import escrow from "./actions/escrow";
import deployment from "./actions/deployment";
import lease from "./actions/lease";
import { tokensProvider } from "./providers/tokens";
import { deploymentProvider } from "./providers/deployment";
import { SUPPORTED_TOKENS, DEPLOYMENT_CONFIGS, LEASE_STATES } from "./utils/constants";

export const CONFIG = {
    SUPPORTED_TOKENS,
    DEPLOYMENT_CONFIGS,
    LEASE_STATES,
};

export const spheronPlugin: Plugin = {
    name: "spheron",
    description: "Spheron Protocol Plugin for Eliza",
    actions: [escrow, deployment, lease],
    evaluators: [],
    providers: [tokensProvider, deploymentProvider],
};

export default spheronPlugin;

// Export types
export * from "./types";
export * from "./environment";
export * from "./utils";
