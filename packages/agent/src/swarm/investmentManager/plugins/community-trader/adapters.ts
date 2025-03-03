/**
 * Type adapters for converting between different data formats
 * Using a more flexible approach without relying on specific db types
 */
import * as types from "./types";
import { Entity, Component, UUID } from "@elizaos/core";

/**
 * Converts any token performance data to the type expected by the application
 * This approach is more flexible and doesn't rely on specific db types
 */
export function adaptTokenPerformance(
    token: any, 
    chain: string = "unknown"
): types.TokenPerformance {
    return {
        chain,
        address: token.tokenAddress || token.token_address || "",
        name: token.name || token.symbol || "",
        symbol: token.symbol || "",
        decimals: token.decimals || 0,
        price: token.price || 0,
        volume: token.volume || 0,
        trades: token.trades || 0,
        liquidity: token.liquidity || 0,
        holders: token.holders || 0,
        price24hChange: token.priceChange24h || token.price_change_24h || 0,
        volume24hChange: token.volumeChange24h || token.volume_change_24h || 0,
        trades24hChange: token.trade_24h_change || token.trades24hChange || 0,
        holders24hChange: token.holderChange24h || token.holder_change_24h || 0,
        metadata: token.metadata || {},
        isScam: Boolean(token.isScam || token.is_scam || false),
        rugPull: Boolean(token.rugPull || token.rug_pull || false),
        sustainedGrowth: Boolean(token.sustainedGrowth || token.sustained_growth || false),
        rapidDump: Boolean(token.rapidDump || token.rapid_dump || false),
        suspiciousVolume: Boolean(token.suspiciousVolume || token.suspicious_volume || false),
        validationTrust: token.validationTrust || token.validation_trust || 0,
        currentMarketCap: token.currentMarketCap || token.current_market_cap || 0,
        initialMarketCap: token.initialMarketCap || token.initial_market_cap || 0,
        createdAt: token.createdAt || token.created_at || new Date(),
        updatedAt: token.updatedAt || token.lastUpdated || token.last_updated || new Date()
    };
}

/**
 * Converts any transaction data to the type expected by the application
 */
export function adaptTransaction(
    tx: any,
    positionId: string = "unknown",
    chain: string = "unknown"
): types.Transaction {
    const id = tx.id || tx.transactionHash || tx.transaction_hash || "";
    
    return {
        id,
        positionId: tx.positionId || tx.position_id || positionId,
        chain: tx.chain || chain,
        tokenAddress: tx.tokenAddress || tx.token_address || "",
        transactionHash: tx.transactionHash || tx.transaction_hash || "",
        type: tx.type || "buy",
        amount: tx.amount || 0,
        price: tx.price || 0,
        isSimulation: Boolean(tx.isSimulation || tx.is_simulation || false),
        timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date()
    };
}

/**
 * Creates an Entity with appropriate Components from recommender data
 * This replaces the custom Recommender type with the Entity-Component pattern
 */
export function createRecommenderEntity(
    rec: any,
    agentId: UUID,
    sourceEntityId: UUID,
    roomId: UUID = null,
    worldId: UUID = null
): Entity {
    // Extract user identifiers from various fields
    const userId = rec?.userId || rec?.user_id || 
        rec?.telegramId || rec?.telegram_id || 
        rec?.discordId || rec?.discord_id || 
        rec?.twitterId || rec?.twitter_id || "unknown";
    
    const username = rec?.username || "unknown";
    const platform = rec?.platform || "unknown";
    const id = rec?.id || userId;
    
    // Create the base entity
    const entity: Entity = {
        id: id as UUID,
        names: [username],
        agentId: agentId,
        metadata: {
            platform,
            isRecommender: true
        },
        components: []
    };
    
    // Create platform-specific components
    if (rec?.telegramId || rec?.telegram_id) {
        const telegramComponent: Component = {
            id: `${id}_telegram` as UUID,
            entityId: id as UUID,
            agentId: agentId,
            roomId: roomId || "unknown" as UUID,
            worldId: worldId || "unknown" as UUID,
            sourceEntityId: sourceEntityId,
            type: "telegram",
            data: {
                username: username,
                userId: rec?.telegramId || rec?.telegram_id
            }
        };
        entity.components.push(telegramComponent);
    }
    
    if (rec?.twitterId || rec?.twitter_id) {
        const twitterComponent: Component = {
            id: `${id}_twitter` as UUID,
            entityId: id as UUID,
            agentId: agentId,
            roomId: roomId || "unknown" as UUID,
            worldId: worldId || "unknown" as UUID,
            sourceEntityId: sourceEntityId,
            type: "twitter",
            data: {
                username: username,
                userId: rec?.twitterId || rec?.twitter_id
            }
        };
        entity.components.push(twitterComponent);
    }
    
    if (rec?.discordId || rec?.discord_id) {
        const discordComponent: Component = {
            id: `${id}_discord` as UUID,
            entityId: id as UUID,
            agentId: agentId,
            roomId: roomId || "unknown" as UUID,
            worldId: worldId || "unknown" as UUID,
            sourceEntityId: sourceEntityId,
            type: "discord",
            data: {
                username: username,
                userId: rec?.discordId || rec?.discord_id
            }
        };
        entity.components.push(discordComponent);
    }
    
    // Add wallet components if available
    if (rec?.address) {
        const walletComponent: Component = {
            id: `${id}_wallet` as UUID,
            entityId: id as UUID,
            agentId: agentId,
            roomId: roomId || "unknown" as UUID,
            worldId: worldId || "unknown" as UUID,
            sourceEntityId: sourceEntityId,
            type: "wallet",
            data: {
                address: rec.address
            }
        };
        entity.components.push(walletComponent);
    }
    
    if (rec?.solanaPubkey || rec?.solana_pubkey) {
        const solanaComponent: Component = {
            id: `${id}_solana` as UUID,
            entityId: id as UUID,
            agentId: agentId,
            roomId: roomId || "unknown" as UUID,
            worldId: worldId || "unknown" as UUID,
            sourceEntityId: sourceEntityId,
            type: "solana",
            data: {
                pubkey: rec?.solanaPubkey || rec?.solana_pubkey
            }
        };
        entity.components.push(solanaComponent);
    }
    
    return entity;
}

/**
 * Creates a simple Recommender object from an Entity
 * This maintains compatibility with existing code
 */
export function createRecommenderFromEntity(entity: Entity): types.Recommender {
    // Extract platform from metadata
    const platform = entity.metadata?.platform || "unknown";
    
    // Default username is the first name in the entity
    let username = entity.names[0] || "unknown";
    
    // Find userId based on platform components
    let userId = entity.id as string;
    let clientId = undefined;
    
    // Look for platform-specific components
    const telegramComponent = entity.components?.find(c => c.type === "telegram");
    const twitterComponent = entity.components?.find(c => c.type === "twitter");
    const discordComponent = entity.components?.find(c => c.type === "discord");
    
    if (platform === "telegram" && telegramComponent) {
        userId = telegramComponent.data.userId || entity.id as string;
        username = telegramComponent.data.username || username;
    } else if (platform === "twitter" && twitterComponent) {
        userId = twitterComponent.data.userId || entity.id as string;
        username = twitterComponent.data.username || username;
    } else if (platform === "discord" && discordComponent) {
        userId = discordComponent.data.userId || entity.id as string;
        username = discordComponent.data.username || username;
    }
    
    // Find clientId if available
    clientId = entity.metadata?.clientId;
    
    return {
        id: entity.id as UUID,
        platform,
        userId,
        username,
        clientId
    };
}

/**
 * Converts any recommender metrics data to the type expected by the application
 */
export function adaptRecommenderMetrics(
    metrics: any
): types.RecommenderMetrics {
    if (!metrics) return null;
    
    return {
        recommenderId: metrics.recommenderId || metrics.recommender_id || "",
        trustScore: metrics.trustScore || metrics.trust_score || 0,
        totalRecommendations: metrics.totalRecommendations || metrics.total_recommendations || 0,
        successfulRecs: metrics.successfulRecs || metrics.successful_recs || 0,
        avgTokenPerformance: metrics.avgTokenPerformance || metrics.avg_token_performance || 0,
        riskScore: metrics.riskScore || metrics.risk_score || 0,
        consistencyScore: metrics.consistencyScore || metrics.consistency_score || 0,
        virtualConfidence: metrics.virtualConfidence || metrics.virtual_confidence || 0,
        lastActiveDate: metrics.lastActiveDate || metrics.last_active_date || new Date(),
        trustDecay: metrics.trustDecay || metrics.trust_decay || 0,
        updatedAt: metrics.updatedAt || metrics.lastUpdated || metrics.last_updated || new Date()
    };
}

/**
 * Safe version of adaptTokenPerformance that handles null/undefined input
 */
export function safeAdaptTokenPerformance(
    token: any,
    chain: string = "unknown"
): types.TokenPerformance | null {
    if (!token) return null;
    try {
        return adaptTokenPerformance(token, chain);
    } catch (error) {
        console.error("Error adapting token performance:", error);
        return null;
    }
}

/**
 * Safe version of adaptTransaction that handles null/undefined input
 */
export function safeAdaptTransaction(
    tx: any,
    positionId: string = "unknown",
    chain: string = "unknown"
): types.Transaction | null {
    if (!tx) return null;
    try {
        return adaptTransaction(tx, positionId, chain);
    } catch (error) {
        console.error("Error adapting transaction:", error);
        return null;
    }
}

/**
 * Safe version of createRecommenderEntity that handles null/undefined input
 */
export function safeCreateRecommenderEntity(
    rec: any,
    agentId: UUID,
    sourceEntityId: UUID,
    roomId: UUID = null,
    worldId: UUID = null
): Entity | null {
    if (!rec) return null;
    try {
        return createRecommenderEntity(rec, agentId, sourceEntityId, roomId, worldId);
    } catch (error) {
        console.error("Error creating recommender entity:", error);
        return null;
    }
}

/**
 * Safe version of createRecommenderFromEntity that handles null/undefined input
 */
export function safeCreateRecommenderFromEntity(
    entity: Entity
): types.Recommender | null {
    if (!entity) return null;
    try {
        return createRecommenderFromEntity(entity);
    } catch (error) {
        console.error("Error creating recommender from entity:", error);
        return null;
    }
}

/**
 * Safe version of adaptRecommenderMetrics that handles null/undefined input
 */
export function safeAdaptRecommenderMetrics(
    metrics: any
): types.RecommenderMetrics | null {
    if (!metrics) return null;
    try {
        return adaptRecommenderMetrics(metrics);
    } catch (error) {
        console.error("Error adapting recommender metrics:", error);
        return null;
    }
} 