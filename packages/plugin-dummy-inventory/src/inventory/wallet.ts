import { IAgentRuntime, InventoryItem, InventoryProvider } from "@elizaos/core";
import { swapAction } from "./actions/swap";
import { transferAction } from "./actions/transfer";

// example inventory item
const inventoryItem: InventoryItem = {
    name: 'ai16z',
    ticker: 'ai16z',
    address: 'AM84n1iLdxgVTAyENBcLdjXoyvjentTbu5Q6EpKV1PeG',
    description:
      'ai16z is the first AI VC fund, fully managed by Marc AIndreessen with recommendations from members of the DAO.',
    quantity: 100,
  };
  
  export const inventoryProvider: InventoryProvider = {
    name: 'Example Inventory Provider',
    description: 'Inventory of items',
    providers: (runtime: IAgentRuntime, params: any) => Promise.resolve([inventoryItem]),
    actions: [swapAction, transferAction],
  };