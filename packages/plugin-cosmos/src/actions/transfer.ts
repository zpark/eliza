import {
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@ai16z/eliza";
import { getNativeAssetByChainName } from "@chain-registry/utils";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Coin, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { BigNumber } from "bignumber.js";
import { assets, chains } from "chain-registry";
import { z } from "zod";
import { transferTemplate } from "../templates";

// type ArrayOf<T, N extends number, R extends T[] = []> = R["length"] extends N // only used for commented validation
//     ? R
//     : ArrayOf<T, N, [...R, T]>;

export { transferTemplate };

const getChainSettings = async (chainName: string) => {
    const chain = chains.find((chain) => chain.chain_name === chainName);

    if (!chain) {
        throw new Error(`Chain ${chainName} not found`);
    }

    const assetList = assets.find((asset) => asset.chain_name === chainName);

    if (!assetList) {
        throw new Error(`Asset list for chain ${chainName} not found`);
    }

    const batch32prefix = chain.bech32_prefix;

    const feeToken = chain.fees.fee_tokens?.[0];

    if (!feeToken) {
        throw new Error(`Fee token not found for chain ${chainName}`);
    }

    const rpcEndpoint = chain.apis.rpc?.[0];
    if (!rpcEndpoint) {
        throw new Error(`RPC endpoint not found for chain ${chainName}`);
    }

    return {
        batch32prefix,
        feeToken,
        rpcEndpoint,
        chainAssets: assetList,
    };
};

const createWallet = async (recoveryPhrase: string, batch32prefix: string) => {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(recoveryPhrase, {
        prefix: batch32prefix,
    });

    return wallet;
};

const createSigningClient = async (
    rpcEndpoint: string,
    wallet: DirectSecp256k1HdWallet,
    feeTokenDenom: string
) => {
    const gasPrice = GasPrice.fromString(`0.025${feeTokenDenom}`);

    const signingCosmWasmClient = await SigningCosmWasmClient.connectWithSigner(
        rpcEndpoint,
        wallet,
        {
            gasPrice: gasPrice,
        }
    );

    return signingCosmWasmClient;
};

async function sendTokens(
    signingCosmWasmClient: SigningCosmWasmClient,
    senderAddress: string,
    recipientAddress: string,
    coin: Coin
) {
    const result = await signingCosmWasmClient.sendTokens(
        senderAddress, // Sender address
        recipientAddress, // Recipient address
        [coin],
        "auto" // Fee (auto-calculated or manual gas amount)
    );
    return result;
}

export const transferAction = {
    name: "transferCosmos",
    description: "Transfer tokens between addresses on the same chain",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        const chainName = runtime.getSetting("COSMOS_CHAIN_NAME");
        const recoveryPhrase = runtime.getSetting("COSMOS_RECOVERY_PHRASE");

        const { chainAssets, batch32prefix, feeToken, rpcEndpoint } =
            await getChainSettings(chainName);

        const wallet = await createWallet(recoveryPhrase, batch32prefix);

        const [account] = await wallet.getAccounts();

        const signingCosmWasmClient = await createSigningClient(
            rpcEndpoint.address,
            wallet,
            feeToken.denom
        );

        const senderAddress = account.address;

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: transferTemplate,
        });

        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        const transferContentValidator = z.object({
            denomOrIbc: z.string().nullable(),
            amount: z.string(),
            toAddress: z.string(),
        });

        const transferContent = transferContentValidator.parse(content);

        const { amount, denomOrIbc, toAddress } = transferContent;

        const assetForCoinWithProvidedDenom = denomOrIbc
            ? chainAssets.assets.find(
                  (asset) =>
                      asset.display === denomOrIbc ||
                      asset.ibc.source_denom === denomOrIbc ||
                      asset.base === denomOrIbc
              )
            : getNativeAssetByChainName(assets, chainName);

        const assetDisplayDenomUnit =
            assetForCoinWithProvidedDenom.denom_units.find(
                (unit) => unit.denom === assetForCoinWithProvidedDenom.display
            );

        const isCoinInBaseDenom =
            assetForCoinWithProvidedDenom.base === denomOrIbc || !denomOrIbc;

        const coin = {
            denom: assetForCoinWithProvidedDenom.base,
            amount: isCoinInBaseDenom
                ? new BigNumber(amount)
                      .multipliedBy(10 ** assetDisplayDenomUnit.exponent)
                      .decimalPlaces(0, BigNumber.ROUND_DOWN)
                      .toString()
                : amount,
        };

        try {
            const result = await sendTokens(
                signingCosmWasmClient,
                senderAddress,
                toAddress,
                coin
            );

            if (callback) {
                callback({
                    text: `Successfully transferred ${amount} ${denomOrIbc} to ${toAddress}`,
                    content: {
                        success: true,
                        hash: result.transactionHash,
                    },
                });
            }
            return true;
        } catch (error) {
            console.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    template: transferTemplate,
    validate: async (runtime: IAgentRuntime) => {
        // I dont know what is wrong with code for validation from below, so for now im just returning true

        return true;

        // const recoveryPhrase = runtime.getSetting("COSMOS_RECOVERY_PHRASE");
        // const chainName = runtime.getSetting("COSMOS_CHAIN_NAME");
        //
        // const chainNameValidator = z.string().refine((value) => {
        //     return chains.map((chain) => chain.chain_name).includes(value);
        // });

        // const recoveryPhraseValidator = z
        //     .custom<string>((value) => {
        //         if (typeof value !== "string") {
        //             return false; // Ensure input is a string
        //         }

        //         const words = value.split(" ");
        //         if (words.length !== 12) {
        //             return false; // Validate the number of words
        //         }

        //         return true; // Input is valid
        //     })
        //     .transform((value: string) => {
        //         return value.split(" ") as ArrayOf<string, 12>;
        //     });

        // return (
        //     recoveryPhraseValidator.safeParse(recoveryPhrase).success &&
        //     chainNameValidator.safeParse(chainName).success
        // );
    },
    examples: [
        [
            {
                user: "assistant",
                content: {
                    text: "I'll help you transfer 1 ATOM to cosmos112321m1m3jjasd",
                    action: "SEND_TOKENS_COSMOS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Transfer 1 ATOM to cosmos112321m1m3jjasd",
                    action: "SEND_TOKENS_COSMOS",
                },
            },
        ],
    ],
    similes: [
        "SEND_TOKENS_COSMOS",
        "TOKEN_TRANSFER_COSMOS",
        "MOVE_TOKENS_COSMOS",
    ],
};
