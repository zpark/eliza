export const getPriceTemplate = `Respond with a JSON object containing symbol, cryptoName, and currency. Currency must default to "USD" if not specified.

Here are the cryptocurrency symbol mappings:
- bitcoin/btc -> BTC (cryptoName: bitcoin)
- ethereum/eth -> ETH (cryptoName: ethereum)
- solana/sol -> SOL (cryptoName: solana)
- cardano/ada -> ADA (cryptoName: cardano)
- ripple/xrp -> XRP (cryptoName: ripple)
- dogecoin/doge -> DOGE (cryptoName: dogecoin)
- polkadot/dot -> DOT (cryptoName: polkadot)
- usdc -> USDC (cryptoName: usd-coin)
- tether/usdt -> USDT (cryptoName: tether)

IMPORTANT: Response must ALWAYS include "symbol", "cryptoName", and "currency" fields.

Example response:
\`\`\`json
{
    "symbol": "BTC",
    "cryptoName": "bitcoin",
    "currency": "USD"
}
\`\`\`

{{recentMessages}}

Extract the cryptocurrency from the most recent message. Always include currency (default "USD").
Respond with a JSON markdown block containing symbol, cryptoName, and currency.`;
