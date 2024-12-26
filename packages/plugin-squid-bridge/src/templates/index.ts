export const xChainSwapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

Extract the following information about the requested cross chain swap:
- Token symbol to swap from
- Token symbol to swap into (if defined)
- Source chain
- Destination chain
- Amount to swap, denominated in the token to be sent
- Destination address (if specified)

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "fromToken": string | null,
    "toToken": string | null,
    "fromChain": string | null,
    "toChain": string | null,
    "amount": string | null,
    "toAddress": string | null
}
\`\`\`
`;
