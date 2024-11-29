import { Plugin } from "@ai16z/eliza";
import { Address, createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalanche } from 'viem/chains'
import 'dotenv/config'
import transfer from './actions/transfer'

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
    // todo
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
    providers: [],
};

export default avalanchePlugin;