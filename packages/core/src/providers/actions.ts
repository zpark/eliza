import { formatActionNames, formatActions } from "../actions";
import { addHeader } from "../prompts";
import { type Action, type IAgentRuntime, type Memory, type Provider, State } from "../types";

export const actionsProvider: Provider = {
  name: "ACTIONS",
  description: "List of actions that can be called",
  position: 99,
  // Get actions that validate for this message
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const actionPromises = runtime.actions.map(async (action: Action) => {
      const result = await action.validate(runtime, message);
      if (result) {
        return action;
      }
      return null;
    });

    // Wait for all validations
    const resolvedActions = await Promise.all(actionPromises);

    // Filter out null values
    const actionsData = resolvedActions.filter(Boolean) as Action[];

    // Format action-related texts
    const actionNames = `Possible response actions: ${formatActionNames(
      actionsData
    )}`;

    const text =
      actionsData.length > 0
        ? addHeader("# Available Actions", formatActions(actionsData))
        : "";

    const values = {
      actionNames,
    };

    const data = {
      actionsData,
    };

    return {
      values,
      data,
      text,
    };
  },
};
