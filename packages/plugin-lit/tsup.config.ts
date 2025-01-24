import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    external: [
        "@elizaos/core",
        "@lit-protocol/lit-node-client",
        "@lit-protocol/contracts-sdk",
        "@lit-protocol/lit-auth-client",
        "@lit-protocol/pkp-ethers",
        "zod"
    ],
    dts: {
        resolve: true,
        entry: {
            index: "src/index.ts"
        }
    },
    treeshake: true,
    splitting: false,
    bundle: true
});
