import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza"
import { Address, formatUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { getDecimals, getTokenBalance } from ".."

const TOKEN_ADDRESSES = {
    AVAX: "0x0000000000000000000000000000000000000000",
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    YAK: "0x59414b3089ce2AF0010e7523Dea7E2b35d776ec7",
    gmYAK: "0x3A30784c1af928CdFce678eE49370220aA716DC3",
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    JOE: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
    AUSD: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    PRINCESS: "0xB310Ed3A7F4Ae79E59dCa99784b312c2D19fFC7C",
}

const walletProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        console.log("walletProvider::get")
        const privateKey = runtime.getSetting("AVALANCHE_PRIVATE_KEY")
        if (!privateKey) {
            throw new Error("AVALANCHE_PRIVATE_KEY not found in environment variables")
        }

        const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`)

        let output = `# Wallet Balances\n\n`
        output += `## Wallet Address\n\n\`${account.address}\`\n\n`
        
        output += `## Latest Token Balances\n\n`
        for (const [token, address] of Object.entries(TOKEN_ADDRESSES)) {
            const decimals = await getDecimals(address as Address)
            const balance = await getTokenBalance(address as Address, account.address)
            output += `${token}: ${formatUnits(balance, decimals)}\n`
        }

        console.log("walletProvider::get output:", output)
        return output
    }
}

export { walletProvider }