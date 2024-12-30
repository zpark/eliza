import {
  CosmosWalletProvider,
  genCosmosChainsFromRuntime,
  initWalletProvider,
} from "../providers/wallet.ts";
import {
  composeContext,
  generateObjectDeprecated,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State,
} from "@ai16z/eliza";
import { balanceTemplate } from "../templates";
import { z } from "zod";

export class BalanceAction {
  constructor(private cosmosWalletProvider: CosmosWalletProvider) {}

  async getBalance() {
    try {
      const activeChain = this.cosmosWalletProvider.getActiveChain();
      const address = this.cosmosWalletProvider.getAddress();
      const balance = await this.cosmosWalletProvider.getWalletBalance();

      return `Address: ${address}\nBalance: ${JSON.stringify(balance, null, 2)}, chain name: ${activeChain}`;
    } catch (error) {
      console.error("Error in Cosmos wallet provider:", error);

      return null;
    }
  }
}

export const balanceAction = {
  name: "COSMOS_WALLET_BALANCE",
  description: "Action for fetching wallet balance on given chain",
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    _callback: HandlerCallback
  ) => {
    console.log("COSMOS_WALLET_BALANCE action handler called");

    // Compose transfer context
    const transferContext = composeContext({
      state: state,
      template: balanceTemplate,
      templatingEngine: "handlebars",
    });

    // Generate transfer content
    const content = await generateObjectDeprecated({
      runtime: _runtime,
      context: transferContext,
      modelClass: ModelClass.LARGE,
    });

    const balanceContentValidator = z.object({
      chainName: z.string(),
    });

    const transferContent = balanceContentValidator.parse(content);

    const { chainName } = transferContent;

    try {
      const walletProvider = await initWalletProvider(
        _runtime,
        chainName
      );
      const action = new BalanceAction(walletProvider);
      const responseText = await action.getBalance();

      await _callback({
        text: responseText,
      });
    } catch (error) {
      await _callback({
        text: error.message,
      });
      console.error("Error in Cosmos wallet provider:", error);
    }

    return;
  },
  validate: async (runtime: IAgentRuntime) => {
    const recoveryPhrase = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
    const chains = genCosmosChainsFromRuntime(runtime);

    return recoveryPhrase !== undefined && Object.keys(chains).length > 0;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Show me balance of my cosmos wallet for chain mantrachaintestnet2",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "",
          action: "COSMOS_WALLET_BALANCE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Show me balance of my cosmos wallet for chain mantrachaintestnet2 use COSMOS_WALLET_BALANCE action",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "",
          action: "COSMOS_WALLET_BALANCE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Show me balance of my wallet for chain mantrachaintestnet2 on cosmos",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "",
          action: "COSMOS_WALLET_BALANCE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "What is my balance on the chain mantrachaintestnet2 on cosmos",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "",
          action: "COSMOS_WALLET_BALANCE",
        },
      },
    ],
  ],
  similes: ["COSMOS_BALANCE", "COSMOS_WALLET_TOKENS"],
};
