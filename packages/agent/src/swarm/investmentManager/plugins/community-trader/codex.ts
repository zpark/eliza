export enum NetworkID {
    ETHEREUM = 1,
    BASE = 8453,
    SOLANA = 1399811149,
}
export class Codex {
    private apiKey: string;
    private graphqlUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.graphqlUrl = "https://graph.codex.io/graphql";
    }

    private async post(query: string, variables: any) {
        const response = await fetch(this.graphqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: this.apiKey,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch data from Codex: ${response.statusText}`
            );
        }

        return response.json();
    }

    private async queryWithRetry(
        query: string,
        variables: any,
        retries = 3
    ) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.post(query, variables);
            } catch (error) {
                console.error(`Retry ${i + 1} failed: ${error}`);
                if (i < retries - 1) {
                    const backoffMs = 2 ** i * 1000;
                    await new Promise((resolve) =>
                        setTimeout(resolve, backoffMs)
                    );
                }
            }
        }
        console.error(`All retries failed for query: ${query}`);
    }

    public async getTokenInfo(networkId: NetworkID, address: string) {
        const query = `
            query TokenInfo($networkId: Int!, $address: String!) {
                token(input: { networkId: $networkId, address: $address }) {
                    id
                    address
                    createdAt
                    cmcId
                    decimals
                    name
                    symbol
                    totalSupply
                    isScam
                    socialLinks {
                        twitter
                        telegram
                        discord
                        website
                        github
                    }
                    info {
                        circulatingSupply
                        imageThumbUrl
                    }
                    explorerData {
                        blueCheckmark
                        description
                        tokenType
                    }
                }
            }
        `;

        const response = await this.queryWithRetry(query, {
            networkId,
            address,
        });
        return response.data.token;
    }

    public async getTokenHolderInfo(
        networkId: NetworkID,
        address: string,
        cursor: string | null = null
    ) {
        const query = `
            query Holders($tokenId: String!, $cursor: String) {
                holders(input: { tokenId: $tokenId, cursor: $cursor }) {
                    items {
                        walletId
                        tokenId
                        balance
                        shiftedBalance
                    }
                    count
                    cursor
                    top10HoldersPercent
                    status
                }
            }
        `;

        const tokenId = `${address}:${networkId}`;
        const response = await this.queryWithRetry(query, { tokenId, cursor });
        return response.data.holders;
    }

    public async getTokenPairs(networkId: NetworkID, address: string) {
        const query = `
            query TokenPairs($networkId: Int!, $tokenAddress: String!) {
                listPairsWithMetadataForToken(tokenAddress: $tokenAddress, networkId: $networkId) {
                    results {
                        pair {
                            id
                            address
                            createdAt
                            fee
                            pooled {
                                token0
                                token1
                            }
                            token0
                            token1
                        }
                        backingToken {
                            address
                        }
                        exchange {
                            id
                            name
                            iconUrl
                            address
                            tradeUrl
                        }
                        volume
                        liquidity
                    }
                }
            }
        `;

        const response = await this.queryWithRetry(query, {
            networkId,
            tokenAddress: address,
        });
        return response.data.listPairsWithMetadataForToken.results;
    }

    public async getLiquidityLocks(
        networkId: NetworkID,
        pairAddress: string,
        cursor: string | null = null
    ) {
        const query = `
            query LiquidityLocks($networkId: Int!, $pairAddress: String!, $cursor: String) {
                liquidityLocks(networkId: $networkId, pairAddress: $pairAddress, cursor: $cursor) {
                    cursor
                    items {
                        createdAt
                        initialAmountToken0
                        initialAmountToken1
                        liquidityAmount
                        liquidityProtocol
                        lockerAddress
                        ownerAddress
                        pairAddress
                        unlockAt
                    }
                }
            }
        `;

        const response = await this.queryWithRetry(query, {
            networkId,
            pairAddress,
            cursor,
        });
        return response.data.liquidityLocks;
    }

    public async getTopTrendingTokens(
        networkFilter?: NetworkID[],
        resolution:
            | "1"
            | "5"
            | "15"
            | "30"
            | "60"
            | "240"
            | "720"
            | "1D" = "1D",
        limit = 50
    ) {
        const query = `
            query TopTokens($networkFilter: [Int!], $resolution: String, $limit: Int) {
                listTopTokens(networkFilter: $networkFilter, resolution: $resolution, limit: $limit) {
                    address
                    createdAt
                    decimals
                    exchanges {
                        id
                        name
                    }
                    id
                    imageBannerUrl
                    imageLargeUrl
                    imageSmallUrl
                    imageThumbUrl
                    isScam
                    lastTransaction
                    liquidity
                    marketCap
                    name
                    networkId
                    price
                    priceChange
                    priceChange1
                    priceChange4
                    priceChange12
                    priceChange24
                    quoteToken
                    resolution
                    symbol
                    topPairId
                    txnCount1
                    txnCount4
                    txnCount12
                    txnCount24
                    uniqueBuys1
                    uniqueBuys4
                    uniqueBuys12
                    uniqueBuys24
                    uniqueSells1
                    uniqueSells4
                    uniqueSells12
                    uniqueSells24
                    volume
                }
            }
        `;

        const response = await this.queryWithRetry(query, {
            networkFilter,
            resolution,
            limit,
        });
        return response.data.listTopTokens;
    }
}
