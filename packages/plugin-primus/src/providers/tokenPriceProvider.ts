import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {generateProof, verifyProof} from "../util/primusUtil.ts";

const tokenPriceProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        //get btc price
        const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
        const method = 'GET';
        const headers = {
            'Accept	': '*/*',
        };
        const attestation = await generateProof(url, method, headers, "", "$.price");
        const valid = await verifyProof(attestation);
        if(!valid){
            throw new Error("Invalid price attestation");
        }
        elizaLogger.info('price attestation:',attestation);
        const responseData = JSON.parse((attestation as any).data);
        const price = responseData.content;
        return  `
        Get BTC price from Binance:
        BTC: ${price} USDT
        Time: ${new Date().toUTCString()}
        POST by eliza #zilia
        Attested by Primus #primus #zktls
        `
    },
};

export { tokenPriceProvider };
