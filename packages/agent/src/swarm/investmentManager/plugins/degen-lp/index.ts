import type { Plugin } from "@elizaos/core";
import { positionProvider } from "./providers/orca/positionProvider";
import { managePositionActionRetriggerEvaluator } from "./evaluators/orca/repositionEvaluator";
import { managePositions } from "./actions/orca/managePositions";

export const degenLPPlugin: Plugin = {
  name: "Degen LP Plugin",
  description: "Autonomous LP position management plugin",
  evaluators: [managePositionActionRetriggerEvaluator],
  providers: [positionProvider],
  actions: [managePositions],
  services: []
};

export default degenLPPlugin;