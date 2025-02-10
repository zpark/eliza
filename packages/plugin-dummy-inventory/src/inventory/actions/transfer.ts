import { InventoryAction, IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const transferAction: InventoryAction = {
    name: 'transfer',
    description: 'Call some inventory action',
    parameters: z.object({
      assetContractAddress: z.string(),
      transferToAddress: z.string(),
      quantity: z.number(),
    }),
    handler: async (_runtime: IAgentRuntime, params: any, _callback: any | undefined) => {
      console.log("Transferring", params);
      
    },
  };