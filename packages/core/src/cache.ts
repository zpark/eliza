import type {
    CacheOptions,
    ICacheManager,
    IDatabaseCacheAdapter,
    UUID,
} from "./types";

export interface ICacheAdapter {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

export class MemoryCacheAdapter implements ICacheAdapter {
    data: Map<string, string>;

    constructor(initalData?: Map<string, string>) {
        this.data = initalData ?? new Map<string, string>();
    }

    async get(key: string): Promise<string | undefined> {
        return this.data.get(key);
    }

    async set(key: string, value: string): Promise<void> {
        this.data.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.data.delete(key);
    }
}

export class DbCacheAdapter implements ICacheAdapter {
    constructor(
        private db: IDatabaseCacheAdapter,
        private agentId: UUID
    ) {}

    async get(key: string): Promise<string | undefined> {
        return this.db.getCache({ agentId: this.agentId, key });
    }

    async set(key: string, value: string): Promise<void> {
        await this.db.setCache({ agentId: this.agentId, key, value });
    }

    async delete(key: string): Promise<void> {
        await this.db.deleteCache({ agentId: this.agentId, key });
    }
}

export class CacheManager<CacheAdapter extends ICacheAdapter = ICacheAdapter>
    implements ICacheManager
{
    adapter: CacheAdapter;

    constructor(adapter: CacheAdapter) {
        this.adapter = adapter;
    }

    async get<T = unknown>(key: string): Promise<T | undefined> {
        const data = await this.adapter.get(key);

        if (data) {
            let parsed = JSON.parse(data) as {
                value: T;
                expires: number;
            };

            // if parsed is a string, JSON.parse it
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                } catch (e) {
                    console.error("Error parsing cache data", e);
                }
            }

            const value = parsed.value;
            const expires = parsed.expires;

            console.log("*** GETTING CACHE ***", { value });
            console.log("data is", data);

            if (!expires || expires > Date.now()) {
                return value;
            }

            this.adapter.delete(key).catch(() => {});
        }

        return undefined;
    }

    async set<T>(key: string, value: T, opts?: CacheOptions): Promise<void> {
        console.log("*** SETTING CACHE ***", { value });
        return this.adapter.set(
            key,
            JSON.stringify({ ...(opts || {}), value })
        );
    }

    async delete(key: string): Promise<void> {
        return this.adapter.delete(key);
    }
}
