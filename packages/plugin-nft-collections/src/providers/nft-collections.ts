import { Provider, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import axios from "axios";

interface NFTCollection {
    name: string;
    totalSupply: number;
    floorPrice: number;
    volume24h: number;
}

const CACHE_TTL = 3600000; // 1 hour
let cachedCollections: NFTCollection[] | null = null;
let lastFetchTime = 0;

async function fetchWithRetry(
    url: string,
    options: any,
    retries = 3
): Promise<any> {
    try {
        return await axios.get(url, options);
    } catch (error) {
        if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

function sanitizeCollection(collection: any): NFTCollection {
    return {
        name: String(collection.name).slice(0, 100),
        totalSupply: Math.max(0, parseInt(collection.totalSupply) || 0),
        floorPrice: Math.max(
            0,
            parseFloat(collection.floorAsk?.price?.amount?.native) || 0
        ),
        volume24h: Math.max(0, parseFloat(collection.volume?.["1day"]) || 0),
    };
}

async function fetchCollectionsWithCache(): Promise<NFTCollection[]> {
    const now = Date.now();
    if (!cachedCollections || now - lastFetchTime > CACHE_TTL) {
        const response = await fetchWithRetry(
            "https://api.reservoir.tools/collections/v6",
            {
                headers: {
                    accept: "application/json",
                    "x-api-key": process.env.RESERVOIR_API_KEY,
                },
            }
        );

        cachedCollections = response.data.collections.map(sanitizeCollection);
        lastFetchTime = now;
    }
    return cachedCollections;
}

function processCollections(collections: NFTCollection[]): string {
    return collections
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 10)
        .map(
            (collection) =>
                `${collection.name}: Supply: ${collection.totalSupply}, Floor: ${collection.floorPrice.toFixed(
                    2
                )} ETH, 24h Volume: ${collection.volume24h.toFixed(2)} ETH`
        )
        .join("\n");
}

export const nftCollectionProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const collections = await fetchCollectionsWithCache();
            return `Current top NFT collections on Ethereum:\n${processCollections(collections)}`;
        } catch (error) {
            console.error("Error fetching NFT collections:", error);
            return "Unable to fetch NFT collection data at the moment.";
        }
    },
};
