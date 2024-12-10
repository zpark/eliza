import { ClientProvider } from "../providers/client";
import {
    WriteContractParams,
    DeployContractParams,
    GetTransactionParams,
    GetCurrentNonceParams,
    WaitForTransactionReceiptParams,
    GetContractSchemaParams,
    GetContractSchemaForCodeParams,
} from "../types";

export class ContractActions {
    private readonly provider: ClientProvider;

    constructor(provider: ClientProvider) {
        this.provider = provider;
    }

    async writeContract(options: WriteContractParams) {
        return this.provider.client.writeContract({
            address: options.contractAddress,
            functionName: options.functionName,
            args: options.functionArgs,
            value: options.value,
            leaderOnly: options.leaderOnly,
        });
    }

    async deployContract(options: DeployContractParams) {
        return this.provider.client.deployContract({
            code: options.code,
            args: options.args,
            leaderOnly: options.leaderOnly,
        });
    }

    async getTransaction(options: GetTransactionParams) {
        return this.provider.client.getTransaction({
            hash: options.hash,
        });
    }

    async getCurrentNonce(options: GetCurrentNonceParams) {
        return this.provider.client.getCurrentNonce({
            address: options.address,
        });
    }

    async waitForTransactionReceipt(options: WaitForTransactionReceiptParams) {
        return this.provider.client.waitForTransactionReceipt({
            hash: options.hash,
            status: options.status,
            interval: options.interval,
            retries: options.retries,
        });
    }

    async getContractSchema(options: GetContractSchemaParams) {
        return this.provider.client.getContractSchema(options.address);
    }

    async getContractSchemaForCode(options: GetContractSchemaForCodeParams) {
        return this.provider.client.getContractSchemaForCode(
            options.contractCode
        );
    }
}
