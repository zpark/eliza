import type { Plugin } from "@elizaos/core";
import { litProvider } from "./providers/litProvider";
import { sendEth } from "./actions/sendEth";
import { sendSol } from "./actions/sendSol";
import { sendUSDC } from "./actions/sendUSDC";

export const litPlugin: Plugin = {
  name: "lit",
  description:
    "Lit Protocol integration for PKP wallet creation and transaction signing",
  providers: [litProvider],
  actions: [sendEth, sendSol, sendUSDC],
  evaluators: [],
};

export default litPlugin;
