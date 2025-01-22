import { Plugin } from "@elizaos/eliza";
import generateMusic from "./actions/generate";
import customGenerateMusic from "./actions/customGenerate";
import extendAudio from "./actions/extend";
import { SunoProvider, sunoProvider } from "./providers/suno";

export {
    SunoProvider,
    generateMusic as GenerateMusic,
    customGenerateMusic as CustomGenerateMusic,
    extendAudio as ExtendAudio
};

export const sunoPlugin: Plugin = {
    name: "suno",
    description: "Suno AI Music Generation Plugin for Eliza",
    actions: [generateMusic, customGenerateMusic, extendAudio],
    evaluators: [],
    providers: [sunoProvider],
};

export default sunoPlugin;