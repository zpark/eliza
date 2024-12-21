export interface CacheManager {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    clear(): Promise<void>;
}

export class MemoryCacheManager implements CacheManager {
    private cache: Map<string, { value: any; expiry: number }>;
    private defaultTtl: number;

    constructor(defaultTtl: number = 3600000) {
        // 1 hour default
        this.cache = new Map();
        this.defaultTtl = defaultTtl;
    }

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        const expiry = Date.now() + (ttl || this.defaultTtl);
        this.cache.set(key, { value, expiry });
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }
}
