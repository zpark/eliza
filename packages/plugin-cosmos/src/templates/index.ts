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

export const transferTemplate = `Given the recent messages and cosmos wallet information below:
{{recentMessages}}
{{walletInfo}}
Extract the following information about the requested transfer:
1. **Amount**:
   - Extract only the numeric value from the instruction.
   - The value must be a string representing the amount in the display denomination (e.g., "0.0001" for OM, chimba, etc.). Do not include the symbol.

2. **Recipient Address**:
   - Must be a valid Bech32 address that matches the chain's address prefix.
   - Example for "mantra": "mantra1pcnw46km8m5amvf7jlk2ks5std75k73aralhcf".

3. **Token Denomination**:
   - If the transfer involves a non-native token, include the display name of the token from the asset list in the chain registry.
   - If the transfer is in the native token, set this field to \`null\`.

4. **Chain**:
   - Identify the chain mentioned in the instruction where the transfer will take place (e.g., carbon, axelar, mantrachaintestnet2).
   - Provide this as a string.
Respond with a JSON markdown block containing only the extracted values. All fields except 'token' are required:
\`\`\`json
{
    "denomOrIbc": string, // The display denomination or null for native tokens.
    "amount": string, // The amount to transfer as a string.
    "toAddress": string, // The recipient's address.
    "fromChain": string // The chain name.
\`\`\`

Example reponse for the input: "Make transfer 0.0001 OM to mantra1pcnw46km8m5amvf7jlk2ks5std75k73aralhcf on mantrachaintestnet2", the response should be:
\`\`\`json
{
    "denomOrIbc": "OM",
    "amount": "0.0001",
    "toAddress": "mantra1pcnw46km8m5amvf7jlk2ks5std75k73aralhcf",
    "fromChain": "mantrachaintestnet2"
\`\`\`

Now respond with a JSON markdown block containing only the extracted values.
`;
