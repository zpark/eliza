import { Action } from "@elizaos/eliza";
import { SunoProvider } from "../providers/suno";
import { GenerateParams, GenerationResponse } from "../types";

const generateMusic: Action<GenerateParams, GenerationResponse> = {
    name: "generate-music",
    description: "Generate music using Suno AI",
    provider: "suno",

    async execute(params: GenerateParams, provider: SunoProvider): Promise<GenerationResponse> {
        const response = await provider.request('/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: params.prompt,
                duration: params.duration || 30,
                temperature: params.temperature || 1.0,
                top_k: params.topK || 250,
                top_p: params.topP || 0.95,
                classifier_free_guidance: params.classifier_free_guidance || 3.0
            })
        });

        return response;
    }
};

export default generateMusic;