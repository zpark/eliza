import { Action } from "@elizaos/eliza";
import { SunoProvider } from "../providers/suno";
import { ExtendParams, GenerationResponse } from "../types";

const extendAudio: Action<ExtendParams, GenerationResponse> = {
    name: "extend-audio",
    description: "Extend the duration of an existing audio generation",
    provider: "suno",

    async execute(params: ExtendParams, provider: SunoProvider): Promise<GenerationResponse> {
        const response = await provider.request('/extend', {
            method: 'POST',
            body: JSON.stringify({
                audio_id: params.audio_id,
                duration: params.duration
            })
        });

        return response;
    }
};

export default extendAudio;