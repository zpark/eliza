import {
    IVerifiableInferenceAdapter,
    VerifiableInferenceOptions,
    VerifiableInferenceResult,
    VerifiableInferenceProvider,
    ModelProviderName,
    models,
    elizaLogger,
} from "@elizaos/core";
import { verifyProof } from "./utils/api";
interface OpacityOptions {
    modelProvider?: ModelProviderName;
    token: string;
    teamId: string;
    teamName: string;
    opacityProverUrl: string;
}

export class OpacityAdapter implements IVerifiableInferenceAdapter {
    public options: OpacityOptions;

    constructor(options: OpacityOptions) {
        this.options = options;
    }

    async generateText(
        context: string,
        modelClass: string,
        options?: VerifiableInferenceOptions
    ): Promise<VerifiableInferenceResult> {
        const provider = this.options.modelProvider || ModelProviderName.OPENAI;
        const baseEndpoint =
            options?.endpoint ||
            `https://gateway.ai.cloudflare.com/v1/${this.options.teamId}/${this.options.teamName}`;
        const model = models[provider].model[modelClass];
        const apiKey = this.options.token;

        if (!apiKey) {
            throw new Error(
                `API key (token) is required for provider: ${provider}`
            );
        }

        elizaLogger.log("Generating text with options:", {
            modelProvider: provider,
            model: modelClass,
        });

        // Get provider-specific endpoint
        let endpoint;
        let authHeader;
        let responseRegex;

        switch (provider) {
            case ModelProviderName.OPENAI:
                endpoint = `${baseEndpoint}/openai/chat/completions`;
                authHeader = `Bearer ${apiKey}`;
                break;
            default:
                throw new Error(`Unsupported model provider: ${provider}`);
        }




        try {
            let body;
            // Handle different API formats
            switch (provider) {
                case ModelProviderName.OPENAI:
                    body = {
                        model: model,
                        messages: [
                            {
                                role: "system",
                                content: context,
                            },
                        ],
                    };
                    break;
                default:
                    throw new Error(`Unsupported model provider: ${provider}`);
            }
            const headers = {
                "Content-Type": "application/json",
                Authorization: authHeader,
                ...options?.headers,
            };
            const cloudflareResponse = await fetch(endpoint, {
                headers: headers,
                body: JSON.stringify(body),
                method: "POST",
            });
            const cloudflareLogId =
            cloudflareResponse.headers.get("cf-aig-log-id");
            const cloudflareResponseJson = await cloudflareResponse.json();
            let proof;
            let attempts = 0;
            const maxAttempts = 3;

            while (!proof && attempts < maxAttempts) {
                try {
                    proof = await this.generateProof(
                        this.options.opacityProverUrl,
                        cloudflareLogId
                    );
                    break;
                } catch (err) {
                    elizaLogger.log("Attempt for Cloudflare log ID:", cloudflareLogId);
                    elizaLogger.log("Opacity prover URL:", this.options.opacityProverUrl);
                    attempts++;
                    if (attempts === maxAttempts) {
                        throw new Error("Failed to generate proof");
                    }
                }
            }

            elizaLogger.log("Proof generated for text generation ID:", cloudflareLogId);

            // // get cloudflare response
            // // Extract text based on provider format
            const text = cloudflareResponseJson.choices[0].message.content;
            const timestamp = Date.now();
            return {
                text: text,
                id: cloudflareLogId,
                provider: VerifiableInferenceProvider.OPACITY,
                timestamp: timestamp,
                proof: proof,
            };
        } catch (error) {
            console.error("Error in Opacity generateText:", error);
            throw error;
        }
    }

    async generateProof(baseUrl: string, logId: string) {
        const response = await fetch(`${baseUrl}/api/logs/${logId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch proof: ${response.statusText}`);
        }
        return await response.json();
    }

    async verifyProof(result: VerifiableInferenceResult): Promise<boolean> {
        const isValid = await verifyProof(
            `${this.options.opacityProverUrl}`,
            result.id,
            result.proof
        );
        console.log("Proof is valid:", isValid.success);
        if (!isValid.success) {
            throw new Error("Proof is invalid");
        }
        return isValid.success;
    }
}

export default OpacityAdapter;
