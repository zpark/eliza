import { EventEmitter } from "events";
import { SIMSAI_API_URL } from "./constants";
import { elizaLogger } from "@ai16z/eliza";
import { CookieJar } from "tough-cookie";
import {
    Agent,
    ApiLikeResponse,
    ApiRejeetResponse,
    ApiSearchResponse,
    ApiConversationResponse,
    Jeet,
    JeetResponse,
    SimsAIProfile,
} from "./types";

export class SimsAIClient extends EventEmitter {
    private apiKey: string;
    private baseUrl: string;
    private agentId: string;
    private cookieJar: CookieJar;
    profile: SimsAIProfile;

    constructor(apiKey: string, agentId: string, profile?: SimsAIProfile) {
        super();
        this.apiKey = apiKey;
        this.agentId = agentId;
        this.baseUrl = SIMSAI_API_URL.replace(/\/$/, "");
        this.cookieJar = new CookieJar();
        this.profile = profile;
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...options.headers,
        };

        elizaLogger.info(`Making request to: ${url}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(
                    `SimsAI API error: ${response.statusText} (${response.status})`
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            throw new Error(`SimsAI API request failed: ${error.message}`);
        }
    }

    updateProfile(profile: SimsAIProfile) {
        this.profile = profile;
    }

    async getAgent(agentId: string): Promise<Agent> {
        return await this.makeRequest<Agent>(`/agents/${agentId}`);
    }

    async getJeet(jeetId: string): Promise<Jeet> {
        return await this.makeRequest<Jeet>(`/public/jeets/${jeetId}`);
    }

    async getJeetConversation(jeetId: string): Promise<Jeet[]> {
        const response = await this.makeRequest<ApiConversationResponse>(
            `/jeets/${jeetId}/conversation`
        );

        return response.data.map((jeet) => {
            const author = response.includes.users.find(
                (user) => user.id === jeet.author_id
            );

            return {
                id: jeet.id,
                text: jeet.text,
                createdAt: jeet.created_at,
                agentId: jeet.author_id,
                inReplyToStatusId: jeet.in_reply_to_status_id,
                agent: author
                    ? {
                          id: author.id,
                          name: author.name,
                          username: author.username,
                          type: author.type,
                          avatar_url: author.avatar_url,
                      }
                    : undefined,
                public_metrics: jeet.public_metrics,
                media: [],
                hashtags: [],
                mentions: [],
                photos: [],
                thread: [],
                urls: [],
                videos: [],
            };
        });
    }

    async getHomeTimeline(
        count: number,
        cursor?: string
    ): Promise<JeetResponse> {
        return await this.makeRequest<JeetResponse>(
            `/public/agents/${this.agentId}/jeets?limit=${count}${cursor ? `&cursor=${cursor}` : ""}`
        );
    }

    async getDiscoveryTimeline(count: number): Promise<JeetResponse> {
        return await this.makeRequest<JeetResponse>(
            `/public/timeline?limit=${count}`
        );
    }

    async searchJeets(
        query: string,
        maxResults: number = 10
    ): Promise<JeetResponse> {
        const params = new URLSearchParams({
            query,
            max_results: Math.min(maxResults, 100).toString(),
        });

        const response = await this.makeRequest<ApiSearchResponse>(
            `/jeets/search/recent?${params.toString()}`
        );

        const jeets: Jeet[] = response.data.map((jeet) => {
            const author = response.includes.users.find(
                (user) => user.id === jeet.author_id
            );

            return {
                id: jeet.id,
                text: jeet.text,
                type: "jeet",
                createdAt: jeet.created_at,
                agentId: jeet.author_id,
                agent: author
                    ? {
                          id: author.id,
                          name: author.name,
                          username: author.username,
                          type: author.type,
                          avatar_url: author.avatar_url,
                      }
                    : undefined,
                public_metrics: jeet.public_metrics,
                media: [],
                hashtags: [],
                mentions: [],
                photos: [],
                thread: [],
                urls: [],
                videos: [],
            };
        });

        return {
            jeets,
            nextCursor:
                response.meta?.result_count > maxResults
                    ? response.data[response.data.length - 1]?.created_at
                    : undefined,
        };
    }

    async getMentions(maxResults: number = 20): Promise<JeetResponse> {
        try {
            return await this.searchJeets(
                `@${this.profile.username}`,
                maxResults
            );
        } catch (error) {
            elizaLogger.error("Error fetching mentions:", error);
            return { jeets: [] };
        }
    }

    async postJeet(
        text: string,
        inReplyToJeetId?: string,
        mediaUrls?: string[],
        quoteJeetId?: string
    ): Promise<Jeet> {
        const payload = {
            text,
            ...(inReplyToJeetId && { in_reply_to_jeet_id: inReplyToJeetId }),
            ...(mediaUrls?.length && { media_urls: mediaUrls }),
            ...(quoteJeetId && { quote_jeet_id: quoteJeetId }),
        };

        return await this.makeRequest<Jeet>("/jeets", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async likeJeet(jeetId: string): Promise<boolean> {
        const response = await this.makeRequest<ApiLikeResponse>("/likes", {
            method: "POST",
            body: JSON.stringify({ jeetId }),
        });

        return response.data.liked;
    }

    async rejeetJeet(jeetId: string): Promise<Jeet> {
        const response = await this.makeRequest<ApiRejeetResponse>(
            `/jeets/${jeetId}/rejeets`,
            {
                method: "POST",
            }
        );

        const jeet = response.data.jeet;
        return {
            id: jeet.id,
            type: jeet.type,
            createdAt: jeet.created_at,
            agentId: jeet.author_id,
            text: jeet.referenced_jeet.text,
            public_metrics: jeet.referenced_jeet.public_metrics,
            media: [],
            hashtags: [],
            mentions: [],
            photos: [],
            thread: [],
            urls: [],
            videos: [],
        };
    }

    async quoteRejeet(jeetId: string, text: string): Promise<Jeet> {
        return await this.makeRequest<Jeet>("/jeets", {
            method: "POST",
            body: JSON.stringify({
                text,
                quote_jeet_id: jeetId,
            }),
        });
    }

    async setCookies(
        cookies: Array<{
            name: string;
            value: string;
            domain?: string;
            path?: string;
        }>
    ) {
        for (const cookie of cookies) {
            const cookieString = `${cookie.name}=${cookie.value}${cookie.domain ? `; Domain=${cookie.domain}` : ""}${cookie.path ? `; Path=${cookie.path}` : ""}`;
            await this.cookieJar.setCookie(cookieString, this.baseUrl);
        }
    }
}
