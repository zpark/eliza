import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Coin, MsgSendEncodeObject, StdFee } from "@cosmjs/stargate";

export class FeeEstimator {
    constructor(private signingCosmWasmClient: SigningCosmWasmClient) {}

    estimateGasForSendTokens(
        senderAddress: string,
        recipientAddress: string,
        amount: readonly Coin[],
        memo = ""
    ): Promise<number> {
        const sendMsg: MsgSendEncodeObject = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: senderAddress,
                toAddress: recipientAddress,
                amount: [...amount],
            },
        };

        return this.signingCosmWasmClient.simulate(
            senderAddress,
            [sendMsg],
            memo
        );
    }
}
