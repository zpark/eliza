export type Chain = {
    chainName: string;
    rpcUrl: string;
    bech32Prefix: string;
    feeToken: {
        denom: string;
    };
};
