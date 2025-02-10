import { InventoryAction, IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const swapAction: InventoryAction = {
    name: 'swap',
    description: 'Swap one inventory item for another',
    parameters: z.object({
      fromContractAddress: z.string(),
      toContractAddress: z.string(),
      quantity: z.number(),
    }),
    handler: async (_runtime: IAgentRuntime, params: any, _callback: any | undefined) => {
      console.log("Swapping", params);
      return JSON.stringify(params.item);
    },
  };