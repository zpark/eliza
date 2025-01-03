import { elizaLogger } from "@elizaos/core";
import { Service } from "@elizaos/core";
import {
    IAgentRuntime,
    ServiceType,
    ITokenizationService,
    TokenizerType,
} from "@elizaos/core";
import { AutoTokenizer } from "@huggingface/transformers";

import { encodingForModel, TiktokenModel } from "js-tiktoken";

export class TokenizationService
    extends Service
    implements ITokenizationService
{
    static serviceType: ServiceType = ServiceType.TOKENIZATION;

    private runtime: IAgentRuntime | null = null;

    getInstance(): ITokenizationService {
        return TokenizationService.getInstance();
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.log("Initializing TokenizationService");
        this.runtime = runtime;
    }

    async trimTokens(context: string, maxTokens: number) {
        const tokenizerModel = this.runtime.getSetting("TOKENIZER_MODEL");
        const tokenizerType = this.runtime.getSetting("TOKENIZER_TYPE");

        if (!tokenizerModel || !tokenizerType) {
            // Default to TikToken truncation using the "gpt-4o-mini" model if tokenizer settings are not defined
            return this.truncateTiktoken("gpt-4o-mini", context, maxTokens);
        }

        // Choose the truncation method based on tokenizer type
        if (tokenizerType === TokenizerType.Auto) {
            return this.truncateAuto(tokenizerModel, context, maxTokens);
        }

        if (tokenizerType === TokenizerType.TikToken) {
            return this.truncateTiktoken(
                tokenizerModel as TiktokenModel,
                context,
                maxTokens
            );
        }

        console.error(`Unsupported tokenizer type: ${tokenizerType}`);
    }

    async truncateAuto(modelPath: string, context: string, maxTokens: number) {
        try {
            const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
            const tokens = tokenizer.encode(context);

            // If already within limits, return unchanged
            if (tokens.length <= maxTokens) {
                return context;
            }

            // Keep the most recent tokens by slicing from the end
            const truncatedTokens = tokens.slice(-maxTokens);

            // Decode back to text - js-tiktoken decode() returns a string directly
            return tokenizer.decode(truncatedTokens);
        } catch (error) {
            console.error("Error in trimTokens:", error);
            // Return truncated string if tokenization fails
            return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
        }
    }

    async truncateTiktoken(
        model: TiktokenModel,
        context: string,
        maxTokens: number
    ) {
        const encoding = encodingForModel(model);

        try {
            // Encode the text into tokens
            const tokens = encoding.encode(context);

            // If already within limits, return unchanged
            if (tokens.length <= maxTokens) {
                return context;
            }

            // Keep the most recent tokens by slicing from the end
            const truncatedTokens = tokens.slice(-maxTokens);

            // Decode back to text - js-tiktoken decode() returns a string directly
            return encoding.decode(truncatedTokens);
        } catch (error) {
            console.error("Error in trimTokens:", error);
            // Return truncated string if tokenization fails
            return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
        }
    }
}

export default TokenizationService;
