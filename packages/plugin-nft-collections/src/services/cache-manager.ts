interface CacheConfig {
    ttl: number;
    maxSize: number;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export class CacheManager {
    private cache: Map<string, CacheEntry<any>>;
    private config: CacheConfig;

    constructor(config: CacheConfig) {
        this.config = config;
        this.cache = new Map();
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if entry has expired
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    async set<T>(key: string, data: T): Promise<void> {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.config.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    async has(key: string): Promise<boolean> {
        return this.cache.has(key);
    }
}
