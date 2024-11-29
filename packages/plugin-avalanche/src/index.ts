import { Plugin } from "@ai16z/eliza";
import { Address, createPublicClient, createWalletClient, http, parseUnits, Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalanche } from 'viem/chains'
import 'dotenv/config'
import transfer from './actions/transfer'
import yakSwap from './actions/yakSwap'
import yakStrategy from './actions/yakStrategy'
import { tokensProvider } from './providers/tokens'
import { strategiesProvider } from './providers/strategies'

// Ensure private key exists
const privateKey = process.env.AVALANCHE_PRIVATE_KEY
if (!privateKey) {
    throw new Error('AVALANCHE_PRIVATE_KEY not found in environment variables')
}

interface YakSwapQuote {
    amounts: bigint[];
    adapters: Address[];
    path: Address[];
    gasEstimate: bigint;
}

// Create account from private key
const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`)

const publicClient = createPublicClient({
    chain: avalanche,
    transport: http()
})

// Create wallet client
const walletClient = createWalletClient({
    account,
    chain: avalanche,
    transport: http()
})

const getBalance = async () => {
    const balance = await publicClient.getBalance({
        address: account.address,
    })
    console.log('Balance:', balance)
    return balance
}

const getQuote = async (fromTokenAddress: Address, toTokenAddress: Address, amount: number) => {
    const decimals = await getDecimals(fromTokenAddress);
    const maxSteps = 2;
    const gasPrice = parseUnits('25', 'gwei');
    const quote = await publicClient.readContract({
        address: "0xC4729E56b831d74bBc18797e0e17A295fA77488c",
        abi: [{
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_amountIn",
                    "type": "uint256"
                },
                {
                    "internalType": "address",
                    "name": "_tokenIn",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "_tokenOut",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "_maxSteps",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_gasPrice",
                    "type": "uint256"
                }
            ],
            "name": "findBestPathWithGas",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "uint256[]",
                            "name": "amounts",
                            "type": "uint256[]"
                        },
                        {
                            "internalType": "address[]",
                            "name": "adapters",
                            "type": "address[]"
                        },
                        {
                            "internalType": "address[]",
                            "name": "path",
                            "type": "address[]"
                        },
                        {
                            "internalType": "uint256",
                            "name": "gasEstimate",
                            "type": "uint256"
                        }
                    ],
                    "internalType": "struct YakRouter.FormattedOfferWithGas",
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }],
        functionName: "findBestPathWithGas",
        args: [parseUnits(amount.toString(), decimals), fromTokenAddress, toTokenAddress, maxSteps, gasPrice]
    })
    console.log('Quote:', quote)
    return quote as YakSwapQuote
}

const getTxReceipt = async (tx: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx
    })
    return receipt
}

const approve = async (tokenAddress: Address, spender: Address, amount: number) => {
    try {
        const decimals = await getDecimals(tokenAddress);
        const { result, request } = await publicClient.simulateContract({
            account,
            address: tokenAddress,
            abi: [{
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "_spender",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "_value",
                        "type": "uint256"
                    }
                ],
                "name": "approve",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            }],
            functionName: 'approve',
            args: [spender, parseUnits(amount.toString(), decimals)]
        })

        if (!result) {
            throw new Error('Approve failed')
        }

        console.log('Request:', request)

        const tx = await walletClient.writeContract(request)
        console.log('Transaction:', tx)
        return tx
    } catch (error) {
        console.error('Error approving:', error)
        return
    }
}

const deposit = async (depositTokenAddress: Address, strategyAddress: Address, amount: number) => {
    try {
        const decimals = await getDecimals(depositTokenAddress);
        const { result, request } = await publicClient.simulateContract({
            account,
            address: strategyAddress,
            abi: [{
                "inputs": [
                  {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                  }
                ],
                "name": "deposit",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }],
            functionName: 'deposit',
            args: [parseUnits(amount.toString(), decimals)]
        })

        // if (!result) {
        //     throw new Error('Deposit failed')
        // }

        console.log('Request:', request)

        const tx = await walletClient.writeContract(request)
        console.log('Transaction:', tx)
        return tx
    }
    catch (error) {
        console.error('Error depositing:', error)
        return
    }
}

const swap = async (quote: YakSwapQuote, recipient?: Address) => {
    const trade = {
        amountIn: quote.amounts[0],
        amountOut: quote.amounts[quote.amounts.length - 1],
        path: quote.path,
        adapters: quote.adapters
    }
    try {
        const { result, request } = await publicClient.simulateContract({
            account,
            address: "0xC4729E56b831d74bBc18797e0e17A295fA77488c",
            abi: [{
                "inputs": [
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "amountIn",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "amountOut",
                                "type": "uint256"
                            },
                            {
                                "internalType": "address[]",
                                "name": "path",
                                "type": "address[]"
                            },
                            {
                                "internalType": "address[]",
                                "name": "adapters",
                                "type": "address[]"
                            }
                        ],
                        "internalType": "struct YakRouter.Trade",
                        "name": "_trade",
                        "type": "tuple"
                    },
                    {
                        "internalType": "address",
                        "name": "_to",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "_fee",
                        "type": "uint256"
                    }
                ],
                "name": "swapNoSplit",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }],
            functionName: "swapNoSplit",
            args: [
                trade,
                recipient || account.address,
                0n
            ]
        })

        const tx = await walletClient.writeContract(request)
        console.log('Transaction:', tx)
        return tx
    } catch (error) {
        console.error('Error simulating contract:', error)
        return
    }
}

const sendNativeAsset = async (recipient: Address, amount: string | number) => {
    const tx = await walletClient.sendTransaction({
        to: recipient,
        value: parseUnits(amount.toString(), 18),
    });
    console.log('Transaction:', tx)
    return tx
}

const getDecimals = async (tokenAddress: Address) => {
    const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: [{
            "inputs": [],
            "name": "decimals",
            "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
            "stateMutability": "view",
            "type": "function"
        }],
        functionName: 'decimals',
    })
    console.log('Decimals:', decimals)
    return decimals
}

const sendToken = async (tokenAddress: Address, recipient: Address, amount: number) => {
    const decimals = await getDecimals(tokenAddress)

    try {
        const { result, request } = await publicClient.simulateContract({
            account,
            address: tokenAddress,
            abi: [{
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "dst",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    }
                ],
                "name": "transfer",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            }],
            functionName: 'transfer',
            args: [recipient, parseUnits(amount.toString(), decimals)],
        })

        if (!result) {
            throw new Error('Transfer failed')
        }

        console.log('Request:', request)

        const tx = await walletClient.writeContract(request)
        console.log('Transaction:', tx)
        return tx

    } catch (error) {
        console.error('Error simulating contract:', error)
        return
    }
}

// Log the public address
console.log('Wallet public address:', account.address)
console.log('Balance:', await getBalance())

export { 
    client, 
    account, 
    getQuote, 
    getTxReceipt,
    approve, 
    swap, 
    getBalance, 
    sendNativeAsset, 
    sendToken, 
    deposit,
    publicClient 
}

export const avalanchePlugin: Plugin = {
    name: "avalanche",
    description: "Avalanche Plugin for Eliza",
    actions: [
        transfer,
        yakSwap,
        yakStrategy
    ],
    evaluators: [],
    providers: [
        tokensProvider,
        strategiesProvider
    ],
};

export default avalanchePlugin;