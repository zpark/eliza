import {
  composeActionExamples,
  formatActionNames,
  formatActions,
} from "../actions";
import {
  formatEvaluatorExamples,
  formatEvaluatorNames,
  formatEvaluators,
} from "../evaluators";
import { addHeader } from "../prompts";
import {
  Action,
  Evaluator,
  IAgentRuntime,
  Memory,
  Provider,
  State,
} from "../types";

export const examplesProvider: Provider = {
  name: "examples",
  description: "Examples of actions and evaluators",
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    // Get actions that validate for this message
    const actionPromises = runtime.actions.map(async (action: Action) => {
      const result = await action.validate(runtime, message, state);
      if (result) {
        return action;
      }
      return null;
    });

    // Get evaluators that validate for this message
    const evaluatorPromises = runtime.evaluators.map(
      async (evaluator: Evaluator) => {
        const result = await evaluator.validate(runtime, message, state);
        if (result) {
          return evaluator;
        }
        return null;
      }
    );

    // Wait for all validations
    const [resolvedEvaluators, resolvedActions] = await Promise.all([
      Promise.all(evaluatorPromises),
      Promise.all(actionPromises),
    ]);

    // Filter out null values
    const evaluatorsData = resolvedEvaluators.filter(Boolean) as Evaluator[];
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

    // Format evaluator-related texts
    const evaluators =
      evaluatorsData.length > 0 ? formatEvaluators(evaluatorsData) : "";

    const evaluatorNames =
      evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : "";

    const evaluatorExamples =
      evaluatorsData.length > 0 ? formatEvaluatorExamples(evaluatorsData) : "";

    const data = {
      actionsData,
      evaluatorsData,
    };

    const values = {
      actions,
      actionNames,
      actionExamples,
      evaluators,
      evaluatorNames,
      evaluatorExamples,
    };

    // Combine all text sections
    const text = [
      actions,
      actionExamples,
      evaluators,
      evaluatorNames,
      evaluatorExamples,
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
