import {
  composeActionExamples,
  formatActionNames,
  formatActions,
} from "../actions";
import { addHeader } from "../prompts";
import type {
  Action,
  Evaluator,
  IAgentRuntime,
  Memory,
  Provider,
} from "../types";

export const actionExamplesProvider: Provider = {
  name: "ACTION_EXAMPLES",
  description: "Examples of response actions",
  get: async (runtime: IAgentRuntime, message: Memory) => {
    // Get actions that validate for this message
    const actionPromises = runtime.actions.map(async (action: Action) => {
      const result = await action.validate(runtime, message);
      if (result) {
        return action;
      }
      return null;
    });

    const resolvedActions = await Promise.all(actionPromises);

    const actionsData = resolvedActions.filter(Boolean) as Action[];

    // Format action-related texts
    const actionNames = `Possible response actions: ${formatActionNames(
      actionsData
    )}`;

    const actions =
      actionsData.length > 0
        ? addHeader("# Available Actions", formatActions(actionsData))
        : "";

    const actionExamples =
      actionsData.length > 0
        ? addHeader("# Action Examples", composeActionExamples(actionsData, 10))
        : "";

    // Get evaluators that validate for this message
    const evaluatorPromises = runtime.evaluators.map(
      async (evaluator: Evaluator) => {
        const result = await evaluator.validate(runtime, message);
        if (result) {
          return evaluator;
        }
        return null;
      }
    );

    const resolvedEvaluators = await Promise.all(evaluatorPromises);


    // Filter out null values
    const evaluatorsData = resolvedEvaluators.filter(Boolean) as Evaluator[];

    const data = {
      actionsData,
      evaluatorsData,
    };

    const values = {
      actions,
      actionNames,
      actionExamples,
    };

    // Combine all text sections
    const text = [
      actions,
      actionNames,
      actionExamples,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      data,
      values,
      text,
    };
  },
};
