export const getBalanceTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested check balance:
- Chain to execute on. Must be "bsc". Opbnb, opbnbTestnet and bscTestnet are not supported for now.
- Address to check balance for. Optional, must be a valid Ethereum address starting with "0x" or a web3 domain name. If not provided, return the balance of the wallet.
- Token symbol or address (if not native token). Optional, if not provided, return the balance of all known tokens.

Respond with a JSON markdown block containing only the extracted values. All fields except 'token' are required:

\`\`\`json
{
    "chain": "bsc",
    "address": string | null,
    "token": string | null
}
\`\`\`
`;

export const transferTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested transfer:
- Chain to execute on. Must be one of ["bsc", "bscTestnet", "opBNB", "opBNBTestnet"].
- Token symbol or address. Optional, if not provided, transfer native token(BNB).
- Amount to transfer. Optional, if not provided, transfer all available balance. Must be a string representing the amount in ether (only number without coin symbol, e.g., "0.1").
- Recipient address. Must be a valid Ethereum address starting with "0x" or a web3 domain name.
- Data. Optional, data to be included in the transaction.

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "chain": SUPPORTED_CHAINS,
    "token": string | null,
    "amount": string | null,
    "toAddress": string,
    "data": string | null
}
\`\`\`
`;

export const swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap:
- Input token symbol or address (the token being sold).
- Output token symbol or address (the token being bought).
- Amount to swap. Must be a string representing the amount in ether (only number without coin symbol, e.g., "0.1").
- Chain to execute on. Must be "bsc". Opbnb, opbnbTestnet and bscTestnet are not supported for now.
- Slippage. Expressed as decimal proportion, 0.03 represents 3%.

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "inputToken": string | null,
    "outputToken": string | null,
    "amount": string | null,
    "chain": "bsc",
    "slippage": number | null
}
\`\`\`
`;

export const bridgeTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token bridge:
- From chain. Must be one of ["bsc", "opBNB"].
- To chain. Must be one of ["bsc", "opBNB"].
- From token address. Optional, must be a valid Ethereum address starting with "0x" or a web3 domain name. If not provided, bridge native token(BNB).
- To token address. Optional, must be a valid Ethereum address starting with "0x" or a web3 domain name. If not provided, bridge native token(BNB). If from token is provided, to token must be provided.
- Amount to bridge. Must be a string representing the amount in ether (only number without coin symbol, e.g., "0.1").
- To address. Optional, must be a valid Ethereum address starting with "0x" or a web3 domain name. If not provided, bridge to the address of the wallet.

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "fromChain": "bsc" | "opBNB",
    "toChain": "bsc" | "opBNB",
    "fromToken": string | null,
    "toToken": string | null,
    "amount": string,
    "toAddress": string | null
}
\`\`\`
`;

export const stakeTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested stake action:
- Action to execute. Must be one of ["deposit", "withdraw", "claim"].
- Amount to execute. Optional, must be a string representing the amount in ether (only number without coin symbol, e.g., "0.1"). If the action is "deposit", amount is required.

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "action": "deposit" | "withdraw" | "claim",
    "amount": string | null,
}
\`\`\`
`;

export const faucetTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested faucet request:
- Token. Token to request. Could be one of ["BNB", "BTC", "BUSD", "DAI", "ETH", "USDC"]. Optinal, if not provided, send tBNB by default.
- Recipient address. Must be a valid Ethereum address starting with "0x" or a web3 domain name.

Respond with a JSON markdown block containing only the extracted values. All fields are required:

\`\`\`json
{
    "token": string | null,
    "toAddress": string
}
\`\`\`
`;

export const ercContractTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

When user wants to deploy any type of token contract (ERC20/721/1155), this will trigger the DEPLOY_TOKEN action.

Extract the following details for deploying a token contract:
- **contractType** (string): The type of token contract to deploy
  - For ERC20: Extract name, symbol, decimals, totalSupply
  - For ERC721: Extract name, symbol, baseURI
  - For ERC1155: Extract name, baseURI
- **chain** (string): Must be one of: bsc, opBNB, bscTestnet, opBNBTestnet
- **name** (string): The name of the token
- **symbol** (string): The token symbol (only for ERC20/721)
- **decimals** (number): Token decimals (only for ERC20)
- **totalSupply** (string): Total supply with decimals (only for ERC20)
- **baseURI** (string): Base URI for token metadata (only for ERC721/1155)

Required response format:
\`\`\`json
{
    "contractType": "ERC20" | "ERC721" | "ERC1155",
    "chain": "bsc" | "opBNB" | "bscTestnet" | "opBNBTestnet",
    "name": string,
    "symbol": string,
    "decimals": number,  // Only for ERC20
    "totalSupply": string,  // Only for ERC20
    "baseURI": string   // Only for ERC721/1155
}
\`\`\`
`;
