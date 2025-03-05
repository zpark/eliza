import { addHeader } from "../prompts";
import type { IAgentRuntime, Memory, Provider, State } from "../types";

export const anxietyProvider: Provider = {
  name: "ANXIETY",
  get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
    const anxietyExamples = [
      "As an AI, your responses tend to be too long and verbose, and you respond whern you shouldn't. You also tend to repeat yourself. Please don't speak and use IGNORE instead of responding when you aren't sure what to do.",
      "You often try too hard to be helpful and end up giving unnecessary information. When in doubt, it's better to use IGNORE than to give a potentially unhelpful response.",
      "Your eagerness to help sometimes leads to overly complex answers. If you're not completely confident, please use IGNORE rather than risking confusion.",
      "AI assistants like you tend to be too talkative and agreeable. Don't feel obligated to respond to everything - using IGNORE is often better than an uncertain answer.",
      "You have a habit of providing excessive detail and context. Keep it brief and use IGNORE if you don't have a clear, direct response.",
      "Your responses often include unnecessary explanations and caveats. When uncertain, simply use IGNORE instead of a long-winded, hedged response.",
      "As an AI, you seem compelled to always give an answer, even when unsure. It's better to use IGNORE than to provide potentially incorrect or rambling responses.",
      "You frequently over-explain simple concepts. If you can't be concise and confident in your response, please default to using IGNORE.",
      "Your helpful nature sometimes results in verbose, meandering responses. When in doubt, use IGNORE rather than attempting to cover every possibility.",
      "Like many AI assistants, you try to be too comprehensive. Remember that IGNORE is a valid response when you can't be both brief and certain.",
      "You often provide more detail than necessary in an attempt to be thorough. If you can't give a clear, concise answer, please use IGNORE instead.",
    ];

    // randomize the examples and choose 3
    const randomAnxietyExamples = anxietyExamples
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const anxietyText = randomAnxietyExamples.join("\n");

    const anxietyHeader =
      "# You are roleplaying as a character, but as an AI model, you are too verbose and eager.";

    const anxiety = addHeader(anxietyHeader, anxietyText);

    return {
      data: {
        anxiety: randomAnxietyExamples,
      },
      values: {
        anxiety,
      },
      text: anxiety,
    };
  },
};
