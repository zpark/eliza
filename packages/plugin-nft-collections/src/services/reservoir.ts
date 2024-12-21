import {
    Service,
    ServiceType,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    ActionExample,
} from "@ai16z/eliza";
import type { NFTCollection, MarketStats, NFTService } from "../types";

export class ReservoirService extends Service implements NFTService {
    private apiKey: string;
    private baseUrl = "https://api.reservoir.tools";
    protected runtime: IAgentRuntime | undefined;

    constructor(apiKey: string) {
        super();
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
            throw new Error("Invalid Reservoir API key provided");
        }
        this.apiKey = apiKey;
    }

    static get serviceType(): ServiceType {
        return "nft" as ServiceType;
    }

    async initialize(): Promise<void> {
        // Register NFT-related actions
        const actions: Action[] = [
            {
                name: "GET_TOP_COLLECTIONS",
                description: "Get top NFT collections by volume",
                similes: ["FETCH_TOP_COLLECTIONS", "LIST_TOP_COLLECTIONS"],
                examples: [
                    [
                        {
                            user: "user",
                            content: {
                                text: "Show me the top NFT collections",
                            },
                        },
                    ],
                ],
                handler: async (
                    _runtime: IAgentRuntime,
                    _message: Memory,
                    _state: State,
                    _options: any,
                    callback?: HandlerCallback
                ) => {
                    const collections = await this.getTopCollections();
                    callback?.({ text: JSON.stringify(collections, null, 2) });
                    return true;
                },
                validate: async () => true,
            },
            {
                name: "GET_MARKET_STATS",
                description: "Get NFT market statistics",
                similes: ["FETCH_MARKET_STATS", "GET_NFT_STATS"],
                examples: [
                    [
                        {
                            user: "user",
                            content: {
                                text: "What are the current NFT market statistics?",
                            },
                        },
                    ],
                ],
                handler: async (
                    _runtime: IAgentRuntime,
                    _message: Memory,
                    _state: State,
                    _options: any,
                    callback?: HandlerCallback
                ) => {
                    const stats = await this.getMarketStats();
                    callback?.({ text: JSON.stringify(stats, null, 2) });
                    return true;
                },
                validate: async () => true,
            },
            // Add other actions similarly...
        ];

        if (!this.runtime) {
            throw new Error("Runtime not initialized");
        }

        actions.forEach((action) => {
            this.runtime?.registerAction(action);
        });
    }

    private async fetchFromReservoir(
        endpoint: string,
        params: Record<string, any> = {}
    ): Promise<any> {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

        try {
            const response = await fetch(url, {
                headers: {
                    accept: "*/*",
                    "x-api-key": this.apiKey,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401 || response.status === 403) {
                    throw new Error("Invalid or expired Reservoir API key");
                }
                throw new Error(
                    `Reservoir API error: ${response.status} - ${errorText}`
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error("Failed to fetch data from Reservoir API");
        }
    }

    async getTopCollections(): Promise<NFTCollection[]> {
        const data = await this.fetchFromReservoir("/collections/v7", {
            limit: 20,
            sortBy: "1DayVolume",
            includeTopBid: true,
            normalizeRoyalties: true,
        });

        return data.collections.map((collection: any) => ({
            address: collection.id,
            name: collection.name,
            symbol: collection.symbol || "",
            description: collection.description,
            imageUrl: collection.image,
            floorPrice: collection.floorAsk?.price?.amount?.native || 0,
            volume24h: collection.volume["1day"] || 0,
            marketCap: collection.marketCap || 0,
            holders: collection.ownerCount || 0,
        }));
    }

    async getMarketStats(): Promise<MarketStats> {
        const data = await this.fetchFromReservoir("/collections/v7", {
            limit: 500,
            sortBy: "1DayVolume",
        });

        const stats = data.collections.reduce(
            (acc: any, collection: any) => {
                acc.totalVolume24h += collection.volume["1day"] || 0;
                acc.totalMarketCap += collection.marketCap || 0;
                acc.totalHolders += collection.ownerCount || 0;
                acc.floorPrices.push(
                    collection.floorAsk?.price?.amount?.native || 0
                );
                return acc;
            },
            {
                totalVolume24h: 0,
                totalMarketCap: 0,
                totalHolders: 0,
                floorPrices: [],
            }
        );

        return {
            totalVolume24h: stats.totalVolume24h,
            totalMarketCap: stats.totalMarketCap,
            totalCollections: data.collections.length,
            totalHolders: stats.totalHolders,
            averageFloorPrice:
                stats.floorPrices.reduce((a: number, b: number) => a + b, 0) /
                stats.floorPrices.length,
        };
    }

    async getCollectionActivity(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(`/collections/activity/v6`, {
            collection: collectionAddress,
            limit: 100,
            includeMetadata: true,
        });
    }

    async getCollectionTokens(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(`/tokens/v7`, {
            collection: collectionAddress,
            limit: 100,
            includeAttributes: true,
            includeTopBid: true,
        });
    }

    async getCollectionAttributes(collectionAddress: string): Promise<any> {
        return await this.fetchFromReservoir(
            `/collections/${collectionAddress}/attributes/v3`
        );
    }

    async createListing(options: {
        tokenId: string;
        collectionAddress: string;
        price: number;
        expirationTime?: number;
        marketplace: "ikigailabs";
        currency?: string;
        quantity?: number;
    }): Promise<{
        listingId: string;
        status: string;
        transactionHash?: string;
        marketplaceUrl: string;
    }> {
        // First, get the order kind and other details from Reservoir
        const orderKind = await this.fetchFromReservoir(`/execute/list/v5`, {
            maker: options.collectionAddress,
            token: `${options.collectionAddress}:${options.tokenId}`,
            weiPrice: options.price.toString(),
            orderKind: "seaport-v1.5",
            orderbook: "ikigailabs",
            currency: options.currency || "ETH",
            quantity: options.quantity || "1",
        });

        // Create the listing using the order data
        const listingData = await this.fetchFromReservoir(`/order/v3`, {
            kind: orderKind.kind,
            data: {
                ...orderKind.data,
                expirationTime:
                    options.expirationTime ||
                    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
        });

        return {
            listingId: listingData.order.hash,
            status: listingData.order.status,
            transactionHash: listingData.order.transactionHash,
            marketplaceUrl: `https://ikigailabs.xyz/assets/${options.collectionAddress}/${options.tokenId}`,
        };
    }

    async cancelListing(options: {
        listingId: string;
        marketplace: "ikigailabs";
    }): Promise<{
        status: string;
        transactionHash?: string;
    }> {
        const cancelData = await this.fetchFromReservoir(`/order/v3/cancel`, {
            orderHash: options.listingId,
            orderbook: "ikigailabs",
        });

        return {
            status: cancelData.status,
            transactionHash: cancelData.transactionHash,
        };
    }

    async getOwnedNFTs(owner: string): Promise<
        Array<{
            tokenId: string;
            collectionAddress: string;
            name: string;
            imageUrl?: string;
            attributes?: Record<string, string>;
        }>
    > {
        const data = await this.fetchFromReservoir(
            `/users/${owner}/tokens/v7`,
            {
                limit: 100,
                includeAttributes: true,
            }
        );

        return data.tokens.map((token: any) => ({
            tokenId: token.tokenId,
            collectionAddress: token.contract,
            name: token.name || `${token.collection.name} #${token.tokenId}`,
            imageUrl: token.image,
            attributes: token.attributes?.reduce(
                (acc: Record<string, string>, attr: any) => {
                    acc[attr.key] = attr.value;
                    return acc;
                },
                {}
            ),
        }));
    }

    async getFloorListings(options: {
        collection: string;
        limit: number;
        sortBy: "price" | "rarity";
    }): Promise<
        Array<{
            tokenId: string;
            price: number;
            seller: string;
            marketplace: string;
        }>
    > {
        const data = await this.fetchFromReservoir(`/tokens/v7`, {
            collection: options.collection,
            limit: options.limit,
            sortBy: options.sortBy === "price" ? "floorAskPrice" : "rarity",
            includeTopBid: true,
            status: "listed",
        });

        return data.tokens.map((token: any) => ({
            tokenId: token.tokenId,
            price: token.floorAsk.price.amount.native,
            seller: token.floorAsk.maker,
            marketplace: token.floorAsk.source.name,
        }));
    }

    async executeBuy(options: {
        listings: Array<{
            tokenId: string;
            price: number;
            seller: string;
            marketplace: string;
        }>;
        taker: string;
    }): Promise<{
        path: string;
        steps: Array<{
            action: string;
            status: string;
        }>;
    }> {
        // Execute buy orders through Reservoir API
        const orders = options.listings.map((listing) => ({
            tokenId: listing.tokenId,
            maker: listing.seller,
            price: listing.price,
        }));

        const data = await this.fetchFromReservoir(`/execute/bulk/v1`, {
            taker: options.taker,
            items: orders,
            skipBalanceCheck: false,
            currency: "ETH",
        });

        return {
            path: data.path,
            steps: data.steps.map((step: any) => ({
                action: step.type,
                status: step.status,
            })),
        };
    }
}
