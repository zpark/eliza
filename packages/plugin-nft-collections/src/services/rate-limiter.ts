interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry>;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        this.limits = new Map();
    }

    async checkLimit(key: string): Promise<boolean> {
        const now = Date.now();
        let entry = this.limits.get(key);

        // If no entry exists or the window has expired, create a new one
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + this.config.windowMs,
            };
            this.limits.set(key, entry);
        }

        // Check if limit is exceeded
        if (entry.count >= this.config.maxRequests) {
            const waitTime = entry.resetTime - now;
            throw new Error(
                `Rate limit exceeded. Please wait ${Math.ceil(
                    waitTime / 1000
                )} seconds.`
            );
        }

        // Increment the counter
        entry.count++;
        return true;
    }

    async resetLimit(key: string): Promise<void> {
        this.limits.delete(key);
    }

    async getRemainingRequests(key: string): Promise<number> {
        const entry = this.limits.get(key);
        if (!entry || Date.now() > entry.resetTime) {
            return this.config.maxRequests;
        }
        return Math.max(0, this.config.maxRequests - entry.count);
    }

    async getResetTime(key: string): Promise<number> {
        const entry = this.limits.get(key);
        if (!entry || Date.now() > entry.resetTime) {
            return Date.now() + this.config.windowMs;
        }
        return entry.resetTime;
    }

    async cleanup(): Promise<void> {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now > entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }
}
