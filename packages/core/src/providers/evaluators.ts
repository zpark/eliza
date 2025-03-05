import { IAgentRuntime, State, Evaluator, Provider } from "../types";
import { Memory } from "../types";
import {
  formatEvaluators,
  formatEvaluatorNames,
  formatEvaluatorExamples,
} from "../evaluators";
import { addHeader } from "../prompts";

export const evaluatorsProvider: Provider = {
  name: "evaluators",
  description: "Evaluators",
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
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
    const resolvedEvaluators = await Promise.all(evaluatorPromises);

    // Filter out null values
    const evaluatorsData = resolvedEvaluators.filter(Boolean) as Evaluator[];

    // Format evaluator-related texts
    const evaluators =
      evaluatorsData.length > 0
        ? addHeader("# Available Evaluators", formatEvaluators(evaluatorsData))
        : "";

    const evaluatorNames =
      evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : "";

    const evaluatorExamples =
      evaluatorsData.length > 0
        ? addHeader(
            "# Evaluator Examples",
            formatEvaluatorExamples(evaluatorsData)
          )
        : "";

    const values = {
      evaluatorsData,
      evaluators,
      evaluatorNames,
      evaluatorExamples,
    };

    // Combine all text sections
    const text = [evaluators, evaluatorExamples].filter(Boolean).join("\n\n");

    return {
      values,
      text,
    };
  },
};
