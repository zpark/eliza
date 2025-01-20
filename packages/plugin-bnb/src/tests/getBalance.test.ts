import { describe, it, beforeEach } from "vitest";
import {
    generatePrivateKey,
    Account,
    privateKeyToAccount,
} from "viem/accounts";

import { GetBalanceAction } from "../actions/getBalance";
import { WalletProvider } from "../providers/wallet";
import { GetBalanceParams } from "../types";

describe("GetBalance Action", () => {
    let account: Account;
    let wp: WalletProvider;
    let ga: GetBalanceAction;

    beforeEach(async () => {
        const pk = generatePrivateKey();
        account = privateKeyToAccount(pk);
        wp = new WalletProvider(pk);
        ga = new GetBalanceAction(wp);
    });

    describe("Get Balance", () => {
        it("get BNB balance", async () => {
            const input: GetBalanceParams = {
                chain: "bsc",
                address: account.address,
                token: "BNB",
            };
            const resp = await ga.getBalance(input);
            console.log("BNB balance", resp.balance);
        });

        it("get USDC balance", async () => {
            const input: GetBalanceParams = {
                chain: "bsc",
                address: account.address,
                token: "USDC",
            };
            const resp = await ga.getBalance(input);
            console.log("USDC balance", resp.balance);
        });

        it("get balance by token contract address", async () => {
            const input: GetBalanceParams = {
                chain: "bsc",
                address: account.address,
                token: "0x55d398326f99059ff775485246999027b3197955",
            };
            const resp = await ga.getBalance(input);
            console.log(
                "0x55d398326f99059ff775485246999027b3197955 balance",
                resp.balance
            );
        });
    });
});
