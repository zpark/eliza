export const transferTemplate = `Given the recent messages and cosmos wallet information below:
{{recentMessages}}
{{walletInfo}}
Extract the following information about the requested transfer:
- Amount to transfer: Must be a string representing the native chain representation in display denom (only number without coin symbol, e.g., "1" [OM, chimba, ...])
- Recipient address: Must be a valid address on this maching chain bech32_prefix (for example "mantra1da8v84tnwnjkz59hqyh08celz8lw8dwqd8cleu")
- denom (if not native token; display name should exist in assetlist file from chain-registry): Optional, leave as null for native token transfers
Respond with a JSON markdown block containing only the extracted values. All fields except 'token' are required:
\`\`\`json
{
    "denomOrIbc": string, //
    "amount": string, //
    "toAddress": string, //
\`\`\`
`;
