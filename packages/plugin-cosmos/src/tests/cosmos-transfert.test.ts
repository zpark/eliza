import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransferAction } from "../actions/cosmosTransfer";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AssetsPicker } from "../services/assets-picker";
import { AssetsAdapter } from "../services/assets-adapter";
import { FeeEstimator } from "../services/fee-estimator";
import { PaidFee } from "../services/paid-fee";
import { Asset } from "../types";

const ASSETS_LIST_MOCK: Asset[] = [
    {
        base: "uatom",
        display: "uatom",
        denom_units: [{ denom: "uatom", exponent: 6 }],
    },
];

vi.mock("@cosmjs/cosmwasm-stargate", () => ({
    SigningCosmWasmClient: {
        connectWithSigner: vi.fn(),
    },
}));

vi.mock("../services/assets-picker");
vi.mock("../services/assets-adapter");
vi.mock("../services/fee-estimator");
vi.mock("../services/paid-fee");

describe("TransferAction", () => {
    const mockWalletProvider = {
        getAccounts: vi.fn(),
    } as unknown as DirectSecp256k1HdWallet;

    const mockRpcEndpoint = "http://localhost:26657";
    const mockChainName = "cosmoshub-4";

    const transferAction = new TransferAction(
        mockWalletProvider,
        mockRpcEndpoint,
        mockChainName,
        ASSETS_LIST_MOCK
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should throw an error if no sender address is found", async () => {
        // @ts-ignore
        mockWalletProvider.getAccounts.mockResolvedValue([]);

        await expect(
            transferAction.transfer({
                amount: "1000",
                toAddress: "cosmos1receiveraddress",
                denomOrIbc: "uatom",
            })
        ).rejects.toThrow("No sender address");
    });

    it("should throw an error if no receiver address is provided", async () => {
        // @ts-ignore
        mockWalletProvider.getAccounts.mockResolvedValue([
            { address: "cosmos1senderaddress" },
        ]);

        await expect(
            transferAction.transfer({
                amount: "1000",
                toAddress: "",
                denomOrIbc: "uatom",
            })
        ).rejects.toThrow("No receiver address");
    });

    it("should perform a successful transfer", async () => {
        const mockSigningClient = {
            sendTokens: vi.fn().mockResolvedValue({
                transactionHash: "mockTxHash",
            }),
        };

        const mockFeeEstimator = {
            estimateGasForSendTokens: vi.fn().mockResolvedValue(200000),
        };
        // @ts-ignore

        SigningCosmWasmClient.connectWithSigner.mockResolvedValue(
            mockSigningClient
        );
        // @ts-ignore
        mockWalletProvider.getAccounts.mockResolvedValue([
            { address: "cosmos1senderaddress" },
        ]);
        // @ts-ignore
        (AssetsPicker as vi.Mock).mockImplementation(() => ({
            getAssetByDenom: vi.fn().mockReturnValue({
                denom: "uatom",
                decimals: 6,
            }),
        }));
        // @ts-ignore
        (AssetsAdapter as vi.Mock).mockImplementation(() => ({
            amountToAmountInBaseDenom: vi.fn().mockReturnValue({
                amount: "1000000",
                denom: "uatom",
            }),
        }));
        // @ts-ignore
        (FeeEstimator as vi.Mock).mockImplementation(() => mockFeeEstimator);
        // @ts-ignore
        (PaidFee.getInstanceWithDefaultEvents as vi.Mock).mockReturnValue({
            getPaidFeeFromReceipt: vi.fn().mockReturnValue("1"),
        });

        const result = await transferAction.transfer({
            amount: "1000",
            toAddress: "cosmos1receiveraddress",
            denomOrIbc: "uatom",
        });

        expect(result).toEqual({
            from: "cosmos1senderaddress",
            to: "cosmos1receiveraddress",
            gasPaidInUOM: "1",
            txHash: "mockTxHash",
        });
    });

    it("should throw an error if transfer fails", async () => {
        const mockSigningClient = {
            sendTokens: () => {
                throw new Error("Transaction failed");
            },
        };
        // @ts-ignore
        SigningCosmWasmClient.connectWithSigner.mockResolvedValue(
            mockSigningClient
        );
        // @ts-ignore
        mockWalletProvider.getAccounts.mockResolvedValue([
            { address: "cosmos1senderaddress" },
        ]);

        await expect(
            transferAction.transfer({
                amount: "1000",
                toAddress: "cosmos1receiveraddress",
                denomOrIbc: "uatom",
            })
        ).rejects.toThrow("Transfer failed with error: {}");
    });
});
