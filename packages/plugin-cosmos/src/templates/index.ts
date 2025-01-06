export const balanceTemplate = `Given the recent messages and cosmos wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested balance:
- chain name: Must be a string

Respond with a JSON markdown block containing only the extracted values. All fields except are required:

\`\`\`json
{
    "chainName": string
}
\`\`\`
`;
