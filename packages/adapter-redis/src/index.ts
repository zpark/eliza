import Redis from "ioredis";
import { IDatabaseCacheAdapter, UUID } from "@ai16z/eliza";

export class RedisClient implements IDatabaseCacheAdapter {
    private client: Redis;

    constructor() {
        this.client = new Redis();

        this.client.on("connect", () => {
            console.log("Connected to Redis");
        });

        this.client.on("error", (err) => {
            console.error("Redis error:", err);
        });
    }

    async getCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<string | undefined> {
        try {
            const redisKey = this.buildKey(params.agentId, params.key);
            const value = await this.client.get(redisKey);
            return value || undefined;
        } catch (err) {
            console.error("Error getting cache:", err);
            return undefined;
        }
    }

    async setCache(params: {
        agentId: UUID;
        key: string;
        value: string;
    }): Promise<boolean> {
        try {
            const redisKey = this.buildKey(params.agentId, params.key);
            await this.client.set(redisKey, params.value);
            return true;
        } catch (err) {
            console.error("Error setting cache:", err);
            return false;
        }
    }

    async deleteCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<boolean> {
        try {
            const redisKey = this.buildKey(params.agentId, params.key);
            const result = await this.client.del(redisKey);
            return result > 0;
        } catch (err) {
            console.error("Error deleting cache:", err);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.client.quit();
            console.log("Disconnected from Redis");
        } catch (err) {
            console.error("Error disconnecting from Redis:", err);
        }
    }

    private buildKey(agentId: UUID, key: string): string {
        return `${agentId}:${key}`; // Constructs a unique key based on agentId and key
    }
}

export default RedisClient;
