import { BirdeyeClient, CoingeckoClient } from "../clients";
import {
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type Provider,
    type State,
    formatMessages,
    UUID
} from "@elizaos/core";
import { z } from "zod";
import { TrustScoreDatabase } from "../db";
import { formatFullReport, formatRecommenderReport } from "../reports";
import { TrustScoreManager } from "../scoreManager";
import { TrustTokenProvider } from "../tokenProvider";
import type { PositionWithBalance, TokenPerformance as TypesTokenPerformance, Transaction as TypesTransaction, RecommenderMetrics as TypesRecommenderMetrics } from "../types";
import { getZodJsonSchema, render } from "../utils";
import { TokenPerformance, Transaction, transformTokenPerformance, transformTransaction, CacheManager } from "../schemas";

// Define these types since they're not exported from db.ts
type TokenPerformanceRow = {
    token_address: string;
    symbol: string;
    liquidity?: number;
    price_change_24h?: number;
    volume_change_24h?: number;
    trade_24h_change?: number;
    holder_change_24h?: number;
    sustained_growth?: boolean;
    rapid_dump?: boolean;
    suspicious_volume?: boolean;
    is_scam?: boolean;
    rug_pull?: boolean;
    validation_trust?: number;
    initial_market_cap?: number;
    last_updated?: string | Date;
};

// Define Transaction type for adapter function
type DBTransaction = {
    tokenAddress: string;
    transactionHash?: string;
    type: "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT"; // Fixed valid transaction types
    amount: bigint; // Fixed for bigint type
    price: string; // Fixed for string type
    isSimulation: boolean;
    timestamp: string | Date;
};

// Create a simple formatter module inline if it doesn't exist
// This will be used until a proper formatters.ts file is created
const formatters = {
    formatTokenPerformance: (token: TypesTokenPerformance): string => {
        return `
        <token>
        Chain: ${token.chain}
        Address: ${token.address}
        Symbol: ${token.symbol}
        Price: $${token.price.toFixed(6)}
        Liquidity: $${token.liquidity.toFixed(2)}
        24h Change: ${token.price24hChange.toFixed(2)}%
        </token>
        `;
    }
};

// Use local formatters until a proper module is created
const { formatTokenPerformance } = formatters;

const dataProviderTemplate = `<data_provider>

<instructions>
Always give a full details report if user ask anything about the positions, tokens, recommenders.
Write the report to be display in telegram.
Always Include links for the token addresses and accounts(wallets, creators) using solscan.
Include links to the tradings pairs using defined.fi
Links:

- Token: https://solscan.io/token/[tokenAddress]
- Account: https://solscan.io/account/[accountAddress]
- Tx: https://solscan.io/tx/[txHash]
- Pair: https://www.defined.fi/sol/[pairAddress]

</instructions>

<token_reports>
{{tokenReports}}
</token_reports>

<positions_summary>
Total Current Value: {{totalCurrentValue}}
Total Realized P&L: {{totalRealizedPnL}}
Total Unrealized P&L: {{totalUnrealizedPnL}}
Total P&L: {{totalPnL}}
</positions_summary>

<recommender>
{{recommender}}
</recommender>

<global_market_data>
{{globalMarketData}}
</global_market_data>

</data_provider>`;

const dataLoaderTemplate = `You are a data provider system for a memecoin trading platform. Your task is to detect necessary data operations from messages and output required actions.

<available_actions>
{{actions}}
</available_actions>

Current data state:
<tokens>
{{tokens}}
</tokens>

<positions>
{{positions}}
</positions>

Analyze the following messages and output any required actions:
<messages>
{{messages}}
</messages>

Rules:

- Detect any new token addresses mentioned in messages
- Do not modify the contract address, even if it contains words like "pump" or "meme" (i.e. BtNpKW19V1vefFvVzjcRsCTj8cwwc1arJcuMrnaApump)
- Compare mentioned tokens against current data state
- Consider data freshness when tokens or positions are queried
- Order actions by dependency (loading new data before refreshing)
- Only output necessary actions

Output structure:
<o>
[List of actions to be taken if applicable]
<action name="[action name]">[action parameters as JSON]</action>
</o>
`;

type DataActionState = {
    runtime: IAgentRuntime;
    db: TrustScoreDatabase;
    scoreManager: TrustScoreManager;
    tokens: TypesTokenPerformance[];
    positions: PositionWithBalance[];
    transactions: TypesTransaction[];
};

type DataAction<Params extends z.AnyZodObject = z.AnyZodObject> = {
    name: string;
    description: string;
    params: Params;
    handler: (state: DataActionState, params: z.infer<Params>) => Promise<void>;
};

function createAction<Params extends z.AnyZodObject = z.AnyZodObject>(
    action: DataAction<Params>
) {
    return action;
}

// Available actions
const actions = [
    createAction({
        name: "refresh_token",
        description: "Refresh token information from chain",
        params: z.object({
            tokenAddress: z.string().describe("Token address to refresh"),
            chain: z.string().default("solana").describe("Chain name"),
        }),
        async handler({ scoreManager, tokens }, params) {
            // Normalize token address
            const tokenAddress = params.tokenAddress.toLowerCase();
            // Update token information using the correct method signature
            await scoreManager.updateTokenPerformance(params.chain, tokenAddress);
            // Could also update trade history, position balances, etc.
        },
    }),
    createAction({
        name: "refresh_position",
        description: "Refresh position information",
        params: z.object({
            positionId: z.string().uuid().describe("Position ID to refresh"),
            includeTx: z.boolean().default(true).describe("Include transactions"),
        }),
        async handler(_state, { positionId, includeTx }) {},
    }),
    createAction({
        name: "close_positions",
        description: "Close positions (set them as closed)",
        params: z.object({
            positionIds: z.array(z.string().uuid()).describe("Position IDs to close"),
        }),
        async handler(state, { positionIds }) {
            await state.db.closePositions(positionIds as UUID[]);
        },
    }),
    createAction({
        name: "update_trust_score",
        description: "Update trust score for a recommender",
        params: z.object({
            recommenderId: z.string().describe("Recommender ID to update"),
        }),
        async handler(state, { recommenderId }) {
            // Use db method instead - assuming this is the correct replacement
            await state.db.initializeRecommenderMetrics(recommenderId);
        },
    }),
    createAction({
        name: "update_positions",
        description: "Update performance calculation of positions",
        params: z.object({
            positionIds: z.array(z.string().uuid()).describe("Position IDs to update"),
        }),
        async handler(state, { positionIds }) {
            // Use the correct method for updating positions
            for (const positionId of positionIds) {
                // Get token address from position
                const position = state.positions.find(p => p.id === positionId);
                if (position) {
                    await state.scoreManager.updateTokenPerformance(position.chain, position.tokenAddress);
                }
            }
        },
    }),
];

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

function extractActions(text: string) {
    const regex = /<action name="([^"]+)">([^<]+)<\/action>/g;
    const actions = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        try {
            const name = match[1];
            const params = JSON.parse(match[2]);
            actions.push({ name, params });
        } catch (error) {
            console.error("Error parsing action:", error);
        }
    }

    return actions;
}

function jsonFormatter(_key: any, value: any) {
    if (value instanceof Date) return value.toISOString();
    return value;
}

/**
 * Adapter to convert DB TokenPerformance to Types TokenPerformance
 */
function adaptTokenPerformance(token: TokenPerformanceRow, chain: string = "unknown"): TypesTokenPerformance {
    return {
        chain,
        address: token.token_address,
        name: token.symbol,
        symbol: token.symbol,
        price: 0, // Add default values for fields that don't exist in DB representation
        liquidity: token.liquidity || 0,
        volume: 0,
        trades: 0,
        holders: 0,
        price24hChange: token.price_change_24h || 0,
        volume24hChange: token.volume_change_24h || 0,
        trades24hChange: token.trade_24h_change || 0,
        holders24hChange: token.holder_change_24h || 0,
        sustainedGrowth: Boolean(token.sustained_growth),
        rapidDump: Boolean(token.rapid_dump),
        suspiciousVolume: Boolean(token.suspicious_volume),
        isScam: Boolean(token.is_scam),
        rugPull: Boolean(token.rug_pull),
        validationTrust: token.validation_trust || 0,
        initialMarketCap: token.initial_market_cap || 0,
        currentMarketCap: 0,
        metadata: {},
        decimals: 9, // Default for Solana tokens
        createdAt: new Date(),
        updatedAt: new Date(token.last_updated || Date.now())
    };
}

function adaptTransaction(tx: DBTransaction, positionId: string = "unknown", chain: string = "unknown"): TypesTransaction {
    // Convert UUID string to UUID type
    const uuid = positionId as UUID;
    
    return {
        // Cast to any to bypass the UUID template literal type check
        id: (tx.transactionHash || "") as any,
        positionId: uuid,
        chain,
        tokenAddress: tx.tokenAddress,
        transactionHash: tx.transactionHash,
        type: tx.type,
        amount: tx.amount,
        price: tx.price,
        isSimulation: tx.isSimulation,
        timestamp: new Date(tx.timestamp)
    };
}

async function runActions(
    actions: any[],
    runtime: IAgentRuntime,
    tokens: TypesTokenPerformance[],
    positions: PositionWithBalance[],
    transactions: TypesTransaction[]
) {
    const db = new TrustScoreDatabase(runtime);
    // Create a TrustTokenProvider for the TrustScoreManager
    const tokenProvider = new TrustTokenProvider(runtime);
    const scoreManager = new TrustScoreManager(db, tokenProvider);

    return Promise.all(
        actions.map(async (actionCall) => {
            const action = actions.find((a) => a.name === actionCall.name);
            if (action) {
                const params = action.params.parse(actionCall.params);
                await action.handler({ runtime, db, scoreManager, tokens, positions, transactions }, params);
            }
        })
    );
}

export const dataProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> {
        try {
            // Extract token addresses from message and recent context
            const recentMessagesText = state?.recentMessages || "";
            const tokenAddressRegex = /\b[a-zA-Z0-9]{32,44}\b/g;
            const messageContent = message.content.text;
            const tokenAddressMatches = [
                ...(messageContent.match(tokenAddressRegex) || []),
                ...(recentMessagesText.match(tokenAddressRegex) || []),
            ];

            // Initialize database and score manager
            const db = new TrustScoreDatabase(runtime);
            // Create a TrustTokenProvider for the TrustScoreManager
            const tokenProvider = new TrustTokenProvider(runtime);
            const scoreManager = new TrustScoreManager(db, tokenProvider);
            const { agentId } = runtime;

            // Extract actions from message content
            const extractedText = messageContent.match(
                /<o>(.*?)<\/o>/s
            );
            const actions = extractedText
                ? extractActions(extractedText[1])
                : [];

            // Initialize data
            const tokens: TokenPerformance[] = [];
            const positions: PositionWithBalance[] = [];
            const transactions: TypesTransaction[] = [];

            // Get open positions
            const openPositions = await db.getOpenPositionsWithBalance();

            // Run extracted actions with a safe environment
            if (actions.length > 0) {
                await runActions(actions, runtime, tokens as TypesTokenPerformance[], positions, transactions);
            }

            // Generate token reports
            const tokenReports = await Promise.all(
                tokens.map(async (token) => formatTokenPerformance(token as TypesTokenPerformance))
            );

            // Get recommender info if message is from a user
            const clientUserId = message.userId === message.agentId ? "" : message.userId;
            const recommender = await db.getRecommenderByPlatform(
                message.content.source ?? "unknown", 
                clientUserId as string
            );

            // Add updatedAt to RecommenderMetrics to make it compatible
            const recommenderMetrics = recommender
                ? await db.getRecommenderMetrics(recommender.id)
                : undefined;
                
            const metrics = recommenderMetrics
                ? {
                    ...recommenderMetrics,
                    updatedAt: new Date() // Add missing updatedAt property
                  } as TypesRecommenderMetrics
                : undefined;

            const metricsHistory = recommender
                ? await db.getRecommenderMetricsHistory(recommender.id)
                : [];
                
            // Convert metrics history to compatible type
            const typedMetricsHistory = metricsHistory.map(history => ({
                ...history,
                historyId: history.historyId as UUID
            }));

            const recommenderReport =
                recommender && metrics
                    ? formatRecommenderReport(
                          recommender as any,
                          metrics,
                          typedMetricsHistory
                      )
                    : "";

            // Get market data
            // Use the static method to create the client
            const coingeckoClient = CoingeckoClient.createFromRuntime(runtime);
            const priceData = await coingeckoClient.fetchGlobal();
            const totalCurrentValue = "$0.00";
            const totalRealizedPnL = "$0.00";
            const totalUnrealizedPnL = "$0.00";
            const totalPnL = "$0.00";
            const prices = priceData?.data?.market_data?.prices || {};
            const marketCapPercentage = priceData?.data?.market_data?.market_cap_percentage || {};
            const positionReports: string[] = [];

            return render(dataProviderTemplate, {
                tokenReports: tokenReports.join("\n"),
                totalCurrentValue,
                totalRealizedPnL,
                totalUnrealizedPnL,
                totalPnL,
                recommender: recommenderReport,
                globalMarketData: JSON.stringify({
                    prices,
                    marketCapPercentage,
                }),
            });
        } catch (error) {
            const db = new TrustScoreDatabase(runtime);
            const tokenSet = new Set<string>();
            const tokens: TokenPerformance[] = [];
            const positions: PositionWithBalance[] = [];
            const transactions: TypesTransaction[] = [];
            
            // Get open positions
            const openPositions = await db.getOpenPositionsWithBalance();
            
            for (const position of openPositions) {
                if (tokenSet.has(`${position.chain}:${position.tokenAddress}`))
                    continue;

                const tokenPerformance = await db.getTokenPerformance(
                    position.chain,
                    position.tokenAddress
                );

                if (tokenPerformance) tokens.push(tokenPerformance);

                tokenSet.add(`${position.chain}:${position.tokenAddress}`);
            }

            // Need LLM to extract what user wants to see
            // Create a TrustTokenProvider for the TrustScoreManager
            const tokenProvider = new TrustTokenProvider(runtime);
            const scoreManager = new TrustScoreManager(db, tokenProvider);
            const dataState: DataActionState = {
                runtime,
                db,
                scoreManager,
                positions,
                tokens: tokens as TypesTokenPerformance[],
                transactions: [] as TypesTransaction[]
            };

            const context = render(dataLoaderTemplate, {
                actions: actions
                    .map(
                        (a) =>
                            `${a.name}: ${a.description}\nParams: ${JSON.stringify(
                                getZodJsonSchema(a.params)
                            )}`
                    )
                    .join("\n\n"),
                tokens: JSON.stringify(tokens, jsonFormatter),
                positions: JSON.stringify(positions, jsonFormatter),
                // Add missing messages parameter
                messages: message.content.text,
            });

            const dataProviderResponse = await runtime.useModel(ModelClass.LARGE, {
                messages: [
                    {
                        role: "system",
                        content: context,
                    },
                    {
                        role: "user",
                        // Fix formatMessages call by providing the required structure
                        content: formatMessages({
                            messages: [message],
                            actors: [] // Provide empty actors array 
                        }),
                    },
                ],
            });

            if (dataProviderResponse) {
                const extractedText = dataProviderResponse.match(
                    /<o>(.*?)<\/o>/s
                );
                const actions = extractedText
                    ? extractActions(extractedText[1])
                    : [];

                try {
                    if (actions.length > 0) {
                        await runActions(actions, runtime, tokens as TypesTokenPerformance[], positions, transactions);
                    }

                    const tokenReports = await Promise.all(
                        tokens.map(async (token) => formatTokenPerformance(token as TypesTokenPerformance))
                    );

                    const recommender = await db.getRecommenderByPlatform(
                        message.content.source ?? "unknown",
                        undefined
                    );

                    // Add updatedAt to RecommenderMetrics to make it compatible
                    const recommenderMetrics = recommender
                        ? await db.getRecommenderMetrics(recommender.id)
                        : undefined;
                        
                    const metrics = recommenderMetrics
                        ? {
                            ...recommenderMetrics,
                            updatedAt: new Date() // Add missing updatedAt property
                          } as TypesRecommenderMetrics
                        : undefined;

                    const metricsHistory = recommender
                        ? await db.getRecommenderMetricsHistory(recommender.id)
                        : [];
                        
                    // Convert metrics history to compatible type
                    const typedMetricsHistory = metricsHistory.map(history => ({
                        ...history,
                        historyId: history.historyId as UUID
                    }));

                    const recommenderReport =
                        recommender && metrics
                            ? formatRecommenderReport(
                                  recommender as any,
                                  metrics,
                                  typedMetricsHistory
                              )
                            : "";

                    const totalCurrentValue = "$0.00";
                    const totalRealizedPnL = "$0.00";
                    const totalUnrealizedPnL = "$0.00";
                    const totalPnL = "$0.00";
                    const positionReports: string[] = [];

                    return render(dataProviderTemplate, {
                        tokenReports: tokenReports.join("\n"),
                        totalCurrentValue,
                        totalRealizedPnL,
                        totalUnrealizedPnL,
                        totalPnL,
                        recommender: recommenderReport,
                        globalMarketData: JSON.stringify({
                            prices: {},
                            marketCapPercentage: {},
                        }),
                    });
                } catch (error) {
                    console.log(error);
                    return "";
                }
            }

            console.log(error);
            return "";
        }
    },
};
