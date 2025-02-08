import { createOpenAI } from "@ai-sdk/openai";
import type { Plugin } from "@elizaos/core";
import { GenerateTextParams, ModelType } from "@elizaos/core";
import { DetokenizeTextParams, TokenizeTextParams } from "@elizaos/core";
import { generateText as aiGenerateText } from "ai";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";

async function tokenizeText(
  model: ModelType,
  context: string,
) {
  const modelName = model === ModelType.TEXT_SMALL ? process.env.OPENAI_SMALL_MODEL ?? process.env.SMALL_MODEL ?? "gpt-4o-mini" : process.env.LARGE_MODEL ?? "gpt-4o";
  const encoding = encodingForModel(modelName as TiktokenModel);
  const tokens = encoding.encode(context);
  return tokens;
}

async function detokenizeText(
  model: ModelType,
  tokens: number[],
) {
  const modelName = model === ModelType.TEXT_SMALL ? process.env.OPENAI_SMALL_MODEL ?? process.env.SMALL_MODEL ?? "gpt-4o-mini" : process.env.OPENAI_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";
  const encoding = encodingForModel(modelName as TiktokenModel);
  return encoding.decode(tokens);
}

export const openaiPlugin: Plugin = {
  name: "openai",
  description: "OpenAI plugin",
  handlers: {
      [ModelType.TEXT_EMBEDDING]: async (text: string | null) => {
        if (!text) {
          // Return zero vector of appropriate length for model
          return new Array(1536).fill(0);
        }

        console.log("text", text)

        const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

        // use fetch to call embedding endpoint
        const response = await fetch(`${baseURL}/embeddings`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text,
          })
        });
        
        const data = await response.json();
        console.log("data", data);
        return data.data[0].embedding;
      },
      [ModelType.TOKENIZE_TEXT]: async ({
        context,
        modelType,
      }: TokenizeTextParams
    ) => {
      return tokenizeText(modelType ?? ModelType.TEXT_LARGE, context);
    },
    [ModelType.DETOKENIZE_TEXT]: async ({
      tokens,
      modelType,
    }: DetokenizeTextParams
  ) => {
    return detokenizeText(modelType ?? ModelType.TEXT_LARGE, tokens);
  },
      [ModelType.TEXT_LARGE]: async ({
        runtime,
        context,
        modelType,
        stopSequences = [],
      }: GenerateTextParams
    ) => {
        // TODO: pull variables from json
        // const variables = runtime.getPluginData("openai");
        
        const temperature = 0.7;
        const frequency_penalty = 0.7;
        const presence_penalty = 0.7;
        const max_response_length = 8192;
    
        const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    
        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL,
        });

        const smallModel = process.env.OPENAI_SMALL_MODEL ?? process.env.SMALL_MODEL ?? "gpt-4o-mini";
        const largeModel = process.env.OPENAI_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";

        // get the model name from the modelType
        const model = modelType === ModelType.TEXT_SMALL ? smallModel : largeModel;
    
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? undefined,
          temperature: temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          stopSequences: stopSequences,
        });
    
        return openaiResponse;
      },
  }
};
export default openaiPlugin;
