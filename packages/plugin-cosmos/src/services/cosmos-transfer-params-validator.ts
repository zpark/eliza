import { elizaLogger } from "@ai16z/eliza";
import { z } from "zod";

const cosmosTransferParamsSchema = z.object({
    fromChain: z.string(),
    denomOrIbc: z.string(),
    amount: z.string(),
    toAddress: z.string(),
});

export type CosmosTransferParams = z.infer<typeof cosmosTransferParamsSchema>;

export class TransferActionParamsValidator {
    validate(params: unknown): CosmosTransferParams {
        try {
            const validParams = cosmosTransferParamsSchema.parse(params);

            return validParams;
        } catch (error) {
            elizaLogger.error(JSON.stringify(error, undefined, 4));
        }
    }
}
