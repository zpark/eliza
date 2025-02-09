export * from "./services/index.ts";

import type { Plugin } from "@elizaos/core";

import {
    AwsS3Service,
    BrowserService,
    PdfService,
    VideoService,
} from "./services/index.ts";

export type NodePlugin = ReturnType<typeof createNodePlugin>;

export function createNodePlugin() {
    return {
        name: "default",
        description: "Default plugin, with basic actions and evaluators",
        services: [
            new BrowserService(),
            new PdfService(),
            new VideoService(),
            new AwsS3Service(),
        ],
        actions: [],
    } as const satisfies Plugin;
}
