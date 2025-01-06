import { PrimusCoreTLS, Attestation } from "@fksyuan/zktls-core-sdk";
import {
    IVerifiableInferenceAdapter,
    VerifiableInferenceOptions,
    VerifiableInferenceResult,
    VerifiableInferenceProvider,
    ModelProviderName,
    models,
} from "@elizaos/core";

interface PrimusOptions {
    appId: string;
    appSecret: string;
    modelProvider?: ModelProviderName;
    token?: string;
}

export class PrimusAdapter implements IVerifiableInferenceAdapter {
    private client: PrimusCoreTLS;
    private options: PrimusOptions;

    constructor(options: PrimusOptions) {
        this.options = options;
        const zkTLS = new PrimusCoreTLS();
        zkTLS.init(this.options.appId, this.options.appSecret);
        this.client = zkTLS;
    }

    async generateText(
        context: string,
        modelClass: string,
        options?: VerifiableInferenceOptions
    ): Promise<VerifiableInferenceResult> {
        const provider = this.options.modelProvider || ModelProviderName.OPENAI;
        const baseEndpoint = options?.endpoint || models[provider].endpoint;
        const model = models[provider].model[modelClass];
        const apiKey = this.options.token;

        if (!apiKey) {
            throw new Error(
                `API key (token) is required for provider: ${provider}`
            );
        }

        // Get provider-specific endpoint
        let endpoint;
        let authHeader;
        let responseParsePath;

        switch (provider) {
            case ModelProviderName.OPENAI:
            case ModelProviderName.ETERNALAI:
            case ModelProviderName.REDPILL:
            case ModelProviderName.NANOGPT:
            case ModelProviderName.HYPERBOLIC:
                endpoint = `${baseEndpoint}/chat/completions`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath =
                    "$.choices[0].message.content";
                break;
            case ModelProviderName.ANTHROPIC:
            case ModelProviderName.CLAUDE_VERTEX:
                endpoint = `${baseEndpoint}/messages`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath =
                    "$.content[0].text";
                break;
            case ModelProviderName.GOOGLE:
                endpoint = `${baseEndpoint}/models/${model}:generateContent`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath = "$.candidates[0].content.parts[0].text";
                break;
            case ModelProviderName.ALI_BAILIAN:
                endpoint = `${baseEndpoint}/chat/completions`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath = "$.choices[0].message.content";
                break;
            case ModelProviderName.VOLENGINE:
                endpoint = `${baseEndpoint}/text/generation`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath = "$.choices[0].message.content";
                break;
            case ModelProviderName.LLAMACLOUD:
            case ModelProviderName.TOGETHER:
            case ModelProviderName.AKASH_CHAT_API:
                endpoint = `${baseEndpoint}/chat/completions`;
                authHeader = `Bearer ${apiKey}`;
                responseParsePath =
                    "$.choices[0].message.content";
                break;
            default:
                throw new Error(`Unsupported model provider: ${provider}`);
        }

        const headers = {
            "Content-Type": "application/json",
            ...options?.headers,
            ...(provider === ModelProviderName.ANTHROPIC || provider === ModelProviderName.CLAUDE_VERTEX
                ? {
                    "anthropic-version": "2023-06-01",
                    "x-api-key": apiKey
                  }
                : { "Authorization": authHeader }),
        };

        try {
            let body;
            // Handle different API formats
            switch (provider) {
                case ModelProviderName.OPENAI:
                case ModelProviderName.ETERNALAI:
                case ModelProviderName.ALI_BAILIAN:
                case ModelProviderName.VOLENGINE:
                case ModelProviderName.LLAMACLOUD:
                case ModelProviderName.NANOGPT:
                case ModelProviderName.HYPERBOLIC:
                case ModelProviderName.TOGETHER:
                case ModelProviderName.AKASH_CHAT_API:
                    body = {
                        model: model.name,
                        messages: [{ role: "user", content: context }],
                        temperature:
                            options?.providerOptions?.temperature ||
                            models[provider].model[modelClass].temperature,
                    };
                    break;
                case ModelProviderName.ANTHROPIC:
                case ModelProviderName.CLAUDE_VERTEX:
                    body = {
                        model: model.name,
                        messages: [{ role: "user", content: context }],
                        max_tokens: models[provider].model[modelClass].maxOutputTokens,
                        temperature:
                            options?.providerOptions?.temperature ||
                            models[provider].model[modelClass].temperature,
                    };
                    break;
                case ModelProviderName.GOOGLE:
                    body = {
                        model: model.name,
                        contents: [
                            { role: "user", parts: [{ text: context }] },
                        ],
                        generationConfig: {
                            temperature:
                                options?.providerOptions?.temperature ||
                                models[provider].model[modelClass].temperature,
                        },
                    };
                    break;
                default:
                    throw new Error(`Unsupported model provider: ${provider}`);
            }

            const attestation = await this.client.startAttestation(this.client.generateRequestParams(
                {
                    url: endpoint,
                    method: "POST",
                    header: headers,
                    body: JSON.stringify(body),
                },
                [
                    {
                        keyName: 'content',
                        parsePath: responseParsePath,
                        parseType: 'string'
                    }
                ]
            ));

            const responseData = JSON.parse(attestation.data);
            let text = JSON.parse(responseData.content);
            return {
                text,
                proof: attestation,
                provider: VerifiableInferenceProvider.PRIMUS,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error("Error in Primus generateText:", error);
            throw error;
        }
    }

    async verifyProof(result: VerifiableInferenceResult): Promise<boolean> {
        // Primus response is self-verifying
        const isValid = await this.client.verifyAttestation(result.proof as Attestation);
        console.log("Proof is valid:", isValid);
        return isValid;
    }
}

export default PrimusAdapter;