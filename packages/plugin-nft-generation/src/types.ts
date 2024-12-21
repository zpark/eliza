import { z } from "zod";
import { Content } from "@ai16z/eliza";


export interface MintNFTContent extends Content {
    collectionAddress: string;
}

export const MintNFTSchema = z.object({
    collectionAddress: z.string(),
});
