import { type Action } from "@elizaos/core";
import { SunoProvider } from "../providers/suno";
import { CustomGenerateParams, GenerationResponse } from "../types";

const customGenerateMusic: Action<CustomGenerateParams, GenerationResponse> = {
    name: "custom-generate-music",
    description: "Generate music with custom parameters using Suno AI",
    provider: "suno",

    async execute(params: CustomGenerateParams, provider: SunoProvider): Promise<GenerationResponse> {
        const response = await provider.request('/custom-generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: params.prompt,
                duration: params.duration || 30,
                temperature: params.temperature || 1.0,
                top_k: params.topK || 250,
                top_p: params.topP || 0.95,
                classifier_free_guidance: params.classifier_free_guidance || 3.0,
                reference_audio: params.reference_audio,
                style: params.style,
                bpm: params.bpm,
                key: params.key,
                mode: params.mode
            })
        });

        return response;
    }
};

export default customGenerateMusic;