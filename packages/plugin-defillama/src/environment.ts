import { z } from "zod";

export const DefiLlamaEnvironmentSchema = z.object({
    DEFILLAMA_API_URL: z.string().default("https://coins.llama.fi"),
    DEFILLAMA_TIMEOUT: z.coerce.number().default(10000),
});

export type DefiLlamaEnvironment = z.infer<typeof DefiLlamaEnvironmentSchema>;
