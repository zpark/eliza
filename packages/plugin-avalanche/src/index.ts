import { Plugin } from "@ai16z/eliza";
import { Address, createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalanche } from 'viem/chains'
import 'dotenv/config'
import transfer from './actions/transfer'
import { tokensProvider } from './providers/tokens'

// Ensure private key exists
const privateKey = process.env.AVALANCHE_PRIVATE_KEY
if (!privateKey) {
  throw new Error('AVALANCHE_PRIVATE_KEY not found in environment variables')
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

const sendNativeAsset = async (recipient: Address, amount: string | number) => {
    const tx = await walletClient.sendTransaction({
        to: recipient,
        value: parseUnits(amount.toString(), 18),
    });
    console.log('Transaction:', tx)
    return tx
}

const sendToken = async (tokenAddress: Address, recipient: Address, amount: number) => {
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

export { client, account, getBalance, sendNativeAsset, sendToken, publicClient }

export const avalanchePlugin: Plugin = {
    name: "avalanche",
    description: "Avalanche Plugin for Eliza",
    actions: [
        transfer
    ],
    evaluators: [],
    providers: [
        tokensProvider
    ],
};

export default avalanchePlugin;