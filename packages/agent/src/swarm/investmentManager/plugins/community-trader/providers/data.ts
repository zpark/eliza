import { BirdeyeClient, CoingeckoClient } from "../clients";
import {
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type Provider,
    type State,
    formatMessages,
} from "@elizaos/core";
import { z } from "zod";
import { TrustScoreDatabase } from "../db";
import { formatFullReport, formatRecommenderReport } from "../reports";
import { TrustScoreManager } from "../scoreManager";
import { TrustTokenProvider } from "../tokenProvider";
import type { PositionWithBalance, TokenPerformance, Transaction } from "../types";
import { getZodJsonSchema, render } from "../utils";

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
<positions_summary>

<recommender>
{{recommender}}
</recommender>

<global_market_data>
{{globalMarketData}}
</global_market_data>

</data_provider>`

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
<output>
[List of actions to be taken if applicable]
<action name="[action name]">[action parameters as JSON]</action>
</output>
`
type DataActionState = {
    runtime: IAgentRuntime;
    db: TrustScoreDatabase;
    scoreManager: TrustScoreManager;
    tokens: TokenPerformance[];
    positions: PositionWithBalance[];
    transactions: Transaction[];
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

const loadToken = createAction({
    name: "loadToken",
    description: "Load token data",
    params: z.object({
        address: z
            .string()
            .optional()
            .nullable()
            .describe(
                "The blockchain contract address of the token if mentioned. This helps disambiguate tokens that might share similar names or symbols"
            ),
        symbol: z
            .string()
            .optional()
            .nullable()
            .describe(
                "The ticker symbol of the recommended asset (e.g., 'BTC', 'AAPL'). Optional as messages may discuss assets without explicit tickers"
            ),
    }),
    async handler({ scoreManager, tokens }, params) {
        const { address } = params;

        if (!address) {
            console.log("no address provided");
            return;
        }

        const tokenPerformance = await scoreManager.updateTokenPerformance(
            "solana",
            address
        );

        if (tokenPerformance) tokens.push(tokenPerformance);
    },
});

const _findPositions = createAction({
    name: "findPositions",
    description: "Find Positions",
    params: z.object({
        tokenAddress: z.string().uuid(),
        recommenderId: z.string().uuid().optional(),
        closed: z.boolean().default(false),
    }),
    async handler(_state, { tokenAddress, recommenderId, closed }) {},
});

const refreshPosition = createAction({
    name: "refreshPosition",
    description: "Refresh Positions",
    params: z.object({
        positionIds: z.array(z.string().uuid()),
    }),
    async handler(state, { positionIds }) {
        const tokensIds = state.positions
            .filter((position) => positionIds.includes(position.id))
            .map((p) => p.tokenAddress);

        const updatedTokens = await Promise.all(
            tokensIds.map((token) =>
                state.scoreManager.updateTokenPerformance("solana", token)
            )
        );

        state.tokens = Array.from(
            new Map(
                [...state.tokens, ...updatedTokens].map((t) => [t.address, t])
            ).values()
        );
    },
});

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string): boolean {
    return UUID_REGEX.test(uuid);
}

const getRecommender = createAction({
    name: "getRecommender",
    description: "Get Recommender",
    params: z.object({
        positionIds: z.array(z.string().uuid()),
    }),
    async handler(state, { positionIds }) {
        const tokensIds = state.positions
            .filter((position) => positionIds.includes(position.id))
            .map((p) => p.tokenAddress);

        const updatedTokens = await Promise.all(
            tokensIds.map((token) =>
                state.scoreManager.updateTokenPerformance("solana", token)
            )
        );

        state.tokens = Array.from(
            new Map(
                [...state.tokens, ...updatedTokens].map((t) => [t.address, t])
            ).values()
        );
    },
});

const dataProviderActions = [
    loadToken,
    refreshPosition,
    getRecommender,
] as DataAction[];

const ACTION_REGEX = /<action\s+name="([^"]+)">({[^}]+})<\/action>/g;

function extractActions(text: string) {
    const actions: { name: string; params: any }[] = [];
    let match: RegExpExecArray | null;

    while ((match = ACTION_REGEX.exec(text)) !== null) {
        try {
            const actionParams = JSON.parse(match[2]);
            // Filter out malformed UUIDs if the action has positionIds
            if (actionParams.positionIds) {
                actionParams.positionIds =
                    actionParams.positionIds.filter(isValidUUID);
            }
            actions.push({
                name: match[1],
                params: actionParams,
            });
        } catch (_e) {
            console.error(`Failed to parse action parameters: ${match[2]}`);
        }
    }

    console.log("actions", actions);

    return actions;
}

function jsonFormatter(_key: any, value: any) {
    if (typeof value === "bigint") return value.toString();
    return value;
}

export const dataProvider = {
    async get(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> {
        if (message.userId === message.agentId) return "";
        try {
            const db = new TrustScoreDatabase(trustDb);

            const scoreManager = new TrustScoreManager(
                db,
                new TrustTokenProvider(runtime)
            );

            const positions = await db.getOpenPositionsWithBalance();

            const closedPositions = positions.filter(
                (position) => position.balance === 0n
            );

            db.closePositions(closedPositions.map((p) => p.id));

            const openPositions = positions.filter(
                (position) => position.balance > 0n
            );
            const transactions =
                openPositions.length > 0
                    ? await db.getPositionsTransactions(
                          openPositions.map((p) => p.id)
                      )
                    : [];

            const tokens: TokenPerformance[] = [];

            const tokenSet = new Set<string>();
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

            state = state ?? (await runtime.composeState(message));

            const dataState: DataActionState = {
                runtime,
                db,
                scoreManager,
                positions,
                tokens,
                transactions,
            };

            const context = render(dataLoaderTemplate, {
                messages: formatMessages({
                    messages: [message],
                    actors: state.actorsData!,
                }),
                actions: JSON.stringify(
                    dataProviderActions.map((action) => ({
                        ...action,
                        params: getZodJsonSchema(action.params),
                    }))
                ),
                // TODO: send minimum amount of data
                tokens: JSON.stringify(tokens, jsonFormatter),
                positions: JSON.stringify(positions, jsonFormatter),
            });

            const dataProviderResponse = await runtime.useModel(ModelClass.LARGE, {
                context: `${context}<output>`,
                stopSequences: ["</output>"],
            });

            const actions = extractActions(dataProviderResponse);

            await Promise.all(
                actions.map(async (actionCall) => {
                    const action = dataProviderActions.find(
                        (action) => action.name === actionCall.name
                    );

                    if (action) {
                        const params = action.params.parse(actionCall.params);
                        await action.handler(dataState, params);
                    }
                })
            );

            const user = await runtime.databaseAdapter.getEntityById(
                message.userId
            );

            if (!user) {
                throw new Error("User not found");
            }

            const {
                positionReports,
                tokenReports,
                totalCurrentValue,
                totalPnL,
                totalRealizedPnL,
                totalUnrealizedPnL,
            } = formatFullReport(
                dataState.tokens,
                dataState.positions,
                transactions
            );

            const recommender = await db.getRecommenderByPlatform(
                // id: message.userId,
                message.content.source ?? "unknown",
                user?.id ?? message.metadata?.clientUserId
            );

            const metrics = recommender
                ? await db.getRecommenderMetrics(recommender.id)
                : undefined;

            const recommenderReport =
                recommender && metrics
                    ? formatRecommenderReport(
                          recommender,
                          metrics,
                          await db.getRecommenderMetricsHistory(recommender.id)
                      )
                    : "";

            const [
                prices,
                {
                    data: { market_cap_percentage: marketCapPercentage },
                },
            ] = await Promise.all([
                BirdeyeClient.createFromRuntime(runtime).fetchPrices(),
                CoingeckoClient.createFromRuntime(runtime).fetchGlobal(),
            ]);

            return render(dataProviderTemplate, {
                tokenReports,
                totalCurrentValue,
                totalRealizedPnL,
                totalUnrealizedPnL,
                totalPnL,

                positions: positionReports
                    .map((report) => `<position>\n${report}\n</position>`)
                    .join("\n"),

                recommender: recommenderReport,

                globalMarketData: JSON.stringify({
                    prices,
                    marketCapPercentage,
                }),
            });
        } catch (error) {
            console.log(error);
            return "";
        }
    },
} satisfies Provider;
