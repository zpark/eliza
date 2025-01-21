import { Plugin } from "@elizaos/core";
import { generateMemeAction } from "./actions/generate-meme.ts";

export * as actions from "./actions";

export const imgflipPlugin: Plugin = {
    name: "imgflip",
    description: "Generate memes using imgflip.com",
    actions: [
        generateMemeAction,
    ],
    evaluators: [],
    providers: [],
};
export default imgflipPlugin;

