import { Plugin } from "@ai16z/eliza";
import { createPublicClient, createWalletClient, http } from 'viem'
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
const client = createWalletClient({
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

// Log the public address
console.log('Wallet public address:', account.address)
console.log('Balance:', await getBalance())

export { client, account, getBalance, publicClient }

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