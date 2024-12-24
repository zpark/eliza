import { describe, it, expect, vi } from "vitest";
import {
    TransferAction,
    CosmosTransferParams,
} from "../actions/cosmosTransfer";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

const TRANSFER_OPERATION_TIMEOUT = 15000;
const RPC_URL = "https://rpc.testcosmos.directory/mantrachaintestnet2";
const CHAIN_NAME = "mantrachaintestnet2";
const BECH_32_PREFIX = "mantra";

const recoveryPhrases =
    "all kind segment tank shove fury develop neck thank ability raccoon live";

const receiver = "mantra17vaml5p0gfj4aaur3rq2qqhc4pxynwtmp9vrw6";

describe("TransferAction", async () => {
    const directSecp256k1HdWallet = await DirectSecp256k1HdWallet.fromMnemonic(
        recoveryPhrases,
        {
            prefix: BECH_32_PREFIX,
        }
    );

    describe("transfer", () => {
        it("should throw an error if receiver address is not available", async () => {
            const transferAction = new TransferAction(
                directSecp256k1HdWallet,
                RPC_URL,
                CHAIN_NAME
            );

            const params: CosmosTransferParams = {
                denomOrIbc: "denom1",
                amount: "1000",
                toAddress: "",
            };

            await expect(transferAction.transfer(params)).rejects.toThrowError(
                "No receiver address"
            );
        });

        it(
            "should perform a transfer and return the transaction details",
            async () => {
                const transferAction = new TransferAction(
                    directSecp256k1HdWallet,
                    RPC_URL,
                    CHAIN_NAME
                );
                const params: CosmosTransferParams = {
                    denomOrIbc: "uom",
                    amount: "1000",
                    toAddress: receiver,
                };

                const result = await transferAction.transfer(params);
                expect(result.to).toEqual(receiver);
            },
            { timeout: TRANSFER_OPERATION_TIMEOUT }
        );

        it(
            "should throw an error if insufficient funds",
            async () => {
                const transferAction = new TransferAction(
                    directSecp256k1HdWallet,
                    RPC_URL,
                    CHAIN_NAME
                );
                const params: CosmosTransferParams = {
                    denomOrIbc: "uom",
                    amount: `${1_000_000_000_000_000}`,
                    toAddress: receiver,
                };

                await expect(
                    transferAction.transfer(params)
                ).rejects.toThrowError();
            },
            { timeout: TRANSFER_OPERATION_TIMEOUT }
        );
    });
});
