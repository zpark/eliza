import { names, uniqueNamesGenerator } from "unique-names-generator";
import type { ActionExample, Evaluator } from "./types.ts";
import { stringArrayFooter } from "./prompts.ts";

/**
 * Template used for the evaluation generateText.
 */
export const evaluationTemplate =
    `Task Examples:
{{evaluatorExamples}}

{{recentMessages}}

Evaluator Functions:
{{evaluators}}

TASK: Based on the most recent conversation, determine which evaluators functions are appropriate to call to call.
Include the name of evaluators that are relevant and should be called in the array
Available evaluator names to include are {{evaluatorNames}}
${stringArrayFooter}`;

/**
 * Formats the names of evaluators into a comma-separated list, each enclosed in single quotes.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the names of all evaluators, each enclosed in single quotes and separated by commas.
 */
export function formatEvaluatorNames(evaluators: Evaluator[]) {
    return evaluators
        .map((evaluator: Evaluator) => `'${evaluator.name}'`)
        .join(",\n");
}

/**
 * Formats evaluator details into a string, including both the name and description of each evaluator.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the name and description of each evaluator, separated by a colon and a newline character.
 */
export function formatEvaluators(evaluators: Evaluator[]) {
    return evaluators
        .map(
            (evaluator: Evaluator) =>
                `'${evaluator.name}: ${evaluator.description}'`
        )
        .join(",\n");
}

/**
 * Formats evaluator examples into a readable string, replacing placeholders with generated names.
 * @param evaluators - An array of evaluator objects, each containing examples to format.
 * @returns A string that presents each evaluator example in a structured format, including context, messages, and outcomes, with placeholders replaced by generated names.
 */
export function formatEvaluatorExamples(evaluators: Evaluator[]) {
    return evaluators
        .map((evaluator) => {
            return evaluator.examples
                .map((example) => {
                    const exampleNames = Array.from({ length: 5 }, () =>
                        uniqueNamesGenerator({ dictionaries: [names] })
                    );

                    let formattedPrompt = example.prompt;
                    let formattedOutcome = example.outcome;

                    exampleNames.forEach((name, index) => {
                        const placeholder = `{{user${index + 1}}}`;
                        formattedPrompt = formattedPrompt.replaceAll(
                            placeholder,
                            name
                        );
                        formattedOutcome = formattedOutcome.replaceAll(
                            placeholder,
                            name
                        );
                    });

                    const formattedMessages = example.messages
                        .map((message: ActionExample) => {
                            let messageString = `${message.user}: ${message.content.text}`;
                            exampleNames.forEach((name, index) => {
                                const placeholder = `{{user${index + 1}}}`;
                                messageString = messageString.replaceAll(
                                    placeholder,
                                    name
                                );
                            });
                            return (
                                messageString +
                                (message.content.action
                                    ? ` (${message.content.action})`
                                    : "")
                            );
                        })
                        .join("\n");

                    return `Prompt:\n${formattedPrompt}\n\nMessages:\n${formattedMessages}\n\nOutcome:\n${formattedOutcome}`;
                })
                .join("\n\n");
        })
        .join("\n\n");
}

/**
 * Generates a string summarizing the descriptions of each evaluator example.
 * @param evaluators - An array of evaluator objects, each containing examples.
 * @returns A string that summarizes the descriptions for each evaluator example, formatted with the evaluator name, example number, and description.
 */
export function formatEvaluatorExampleDescriptions(evaluators: Evaluator[]) {
    return evaluators
        .map((evaluator) =>
            evaluator.examples
                .map(
                    (_example, index) =>
                        `${evaluator.name} Example ${index + 1}: ${evaluator.description}`
                )
                .join("\n")
        )
        .join("\n\n");
}
