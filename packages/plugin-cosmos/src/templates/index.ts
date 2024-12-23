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
    "amount": string, // to be used with BigNumber libary
    "toAddress": string, //  (for example "mantra1da8v84tnwnjkz59hqyh08celz8lw8dwqd8cleu")
}
\`\`\`
`;

// export const bridgeTemplate = `Given the recent messages and wallet information below:

// {{recentMessages}}

// {{walletInfo}}

// Extract the following information about the requested token bridge:
// - Token symbol or address to bridge
// - Source chain
// - Destination chain
// - Amount to bridge
// - Destination address (if specified)

// Respond with a JSON markdown block containing only the extracted values:

// \`\`\`json
// {
//     "token": string | null,
//     "fromChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
//     "toChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
//     "amount": string | null,
//     "toAddress": string | null
// }
// \`\`\`
// `;

// export const swapTemplate = `Given the recent messages and wallet information below:

// {{recentMessages}}

// {{walletInfo}}

// Extract the following information about the requested token swap:
// - Input token symbol or address (the token being sold)
// - Output token symbol or address (the token being bought)
// - Amount to swap
// - Chain to execute on

// Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

// \`\`\`json
// {
//     "inputToken": string | null,
//     "outputToken": string | null,
//     "amount": string | null,
//     "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
//     "slippage": number | null
// }
// \`\`\`
// `;
