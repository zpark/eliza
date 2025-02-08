import { createOpenAI } from "@ai-sdk/openai";
import type { Plugin } from "@elizaos/core";
import { GenerateTextParams, ModelClass } from "@elizaos/core";
import { generateText as aiGenerateText } from "ai";

export const openaiPlugin: Plugin = {
  modelHandlers: {
      [ModelClass.TEXT_EMBEDDING]: (text: string) => {
        return text;
      },
      [ModelClass.TEXT_GENERATION]: ({
        runtime,
        context,
        modelClass,
        stop,
      }: GenerateTextParams
    ) => {
        const variables = runtime.getPluginData("openai");
        const modelConfiguration = variables?.modelConfig;
        const temperature = variables?.temperature;
        const frequency_penalty = modelConfiguration?.frequency_penalty;
        const presence_penalty = modelConfiguration?.presence_penalty;
        const max_response_length = modelConfiguration?.maxOutputTokens;
    
        const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    
        //logger.debug("OpenAI baseURL result:", { baseURL });
        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL,
          fetch: runtime.fetch,
        });
    
        // get the model name from the modelClass
        const model = modelClass.name;
    
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? undefined,
          temperature: temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
        });
    
        return openaiResponse;
      },
  }
};
export default openaiPlugin;
