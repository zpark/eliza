import { Address } from "genlayer-js/types";

// Action parameters
export interface ReadContractParams {
    contractAddress: Address;
    functionName: string;
    functionArgs: any[];
}
