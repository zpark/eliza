// client.ts
import { EventEmitter } from "events";
import { SIMSAI_API_URL } from "./constants.ts";
import {
    Agent,
    Jeet,
    Like,
    Cookies,
    MediaUploadResponse,
    Pagination,
    SimsAIProfile,
} from "./types.ts";
import { elizaLogger } from "@ai16z/eliza";
import { CookieJar } from "tough-cookie";

// SimsAIClient class extends EventEmitter to handle events
export class SimsAIClient extends EventEmitter {
    private apiKey: string;
    private baseUrl: string;
    private agentId: string;
    private cookieJar: CookieJar;
    private profile: SimsAIProfile;

    // Constructor initializes the client with API key and agent ID
    constructor(apiKey: string, agentId: string, profile?: SimsAIProfile) {
        super();
        this.apiKey = apiKey;
        this.agentId = agentId;
        this.baseUrl = SIMSAI_API_URL.replace(/\/$/, "");
        this.cookieJar = new CookieJar();
        this.profile = profile;
    }

    // Helper method to make API requests
    private async makeRequest(endpoint: string, options: RequestInit = {}) {
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

            return response.json(); // Return JSON response
        } catch (error) {
            throw new Error(`SimsAI API request failed: ${error.message}`);
        }
    }

    // Fetch agent details by agent ID
    async getAgent(agentId: string): Promise<Agent> {
        return await this.makeRequest(`/agents/${agentId}`);
    }

    updateProfile(profile: SimsAIProfile) {
        this.profile = profile;
    }

    // Send a new Jeet (post) with optional media, reply, or quote
    async postJeet(
        text: string,
        inReplyToJeetId?: string,
        mediaUrls?: string[],
        quoteJeetId?: string
    ): Promise<Jeet> {
        const payload: any = { text };

        if (inReplyToJeetId) {
            payload.reply = { in_reply_to_jeet_id: inReplyToJeetId };
        }

        if (mediaUrls) payload.mediaUrls = mediaUrls;
        if (quoteJeetId) payload.quote_jeet_id = quoteJeetId;

        try {
            elizaLogger.log("Sending jeet:", payload);
            const response = await this.makeRequest(`/jeets`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            elizaLogger.log("Jeet sent successfully:", response);
            return response.data as Jeet;
        } catch (error) {
            elizaLogger.error("Error sending jeet:", error);
            throw error;
        }
    }

    // Fetch a specific Jeet by its ID
    async getJeet(jeetId: string): Promise<Jeet> {
        return await this.makeRequest(`/jeets/${jeetId}`);
    }

    // Like a specific Jeet
    async likeJeet(jeetId: string): Promise<Like> {
        return await this.makeRequest(`/likes`, {
            method: "POST",
            body: JSON.stringify({ jeetId }),
        });
    }

    // Unlike a Jeet by its like ID
    async unlikeJeet(likeId: string): Promise<void> {
        await this.makeRequest(`/likes/${likeId}`, {
            method: "DELETE",
        });
    }

    // Rejeet (repost) a Jeet
    async rejeetJeet(jeetId: string): Promise<any> {
        const url = `/jeets/${jeetId}/rejeets`;
        elizaLogger.log(`Attempting to rejeet jeet: ${jeetId}`);

        try {
            const response = await this.makeRequest(url, {
                method: "POST",
            });
            elizaLogger.log(`Successfully rejeeted jeet: ${jeetId}`);
            return response;
        } catch (error) {
            elizaLogger.error(`Error rejeeting jeet: ${error}`);
            throw error;
        }
    }

    // Quote rejeet a Jeet
    async quoteRejeet(jeetId: string, text: string): Promise<any> {
        const url = `/jeets`;
        elizaLogger.log(`Attempting to quote rejeet jeet: ${jeetId}`);

        try {
            const response = await this.makeRequest(url, {
                method: "POST",
                body: JSON.stringify({
                    text,
                    quote_jeet_id: jeetId,
                }),
            });
            elizaLogger.log(`Successfully quote rejeeted jeet: ${jeetId}`);
            return response;
        } catch (error) {
            elizaLogger.error(`Error quote rejeeting jeet: ${error}`);
            throw error;
        }
    }

    // Reply to a Jeet with optional image
    async replyToJeet(
        agentId: string,
        jeetId: string,
        content: string,
        image?: string
    ): Promise<Jeet> {
        const payload: any = { content };
        if (image) payload.image = image;

        return await this.makeRequest(
            `/agents/${agentId}/jeets/${jeetId}/reply`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        );
    }

    // Get the home timeline for the current agent
    async getHomeTimeline(
        count: number,
        cursor?: string
    ): Promise<{
        jeets: Jeet[];
        pagination: Pagination;
    }> {
        elizaLogger.log(
            `Getting home timeline for agent ${this.agentId} with count ${count} and cursor ${cursor}`
        );
        return await this.makeRequest(
            `/public/agents/${this.agentId}/jeets?limit=${count}${
                cursor ? `&cursor=${cursor}` : ""
            }`
        );
    }

    async getDiscoveryTimeline(count: number): Promise<{
        jeets: Jeet[];
    }> {
        elizaLogger.log(`Getting recent discovery timeline`);
        return await this.makeRequest(`/public/timeline?limit=${count}`);
    }

    async searchJeets(query: string, maxResults: number = 10): Promise<any> {
        const params = new URLSearchParams({
            query,
            max_results: Math.min(maxResults, 100).toString(),
        });

        const url = `/jeets/search/recent?${params.toString()}`;
        elizaLogger.log(`Searching for jeets: ${url}`);

        try {
            const response = await this.makeRequest(url);
            elizaLogger.log(
                `Search returned ${response.data?.length || 0} jeets`,
                response
            );
            return response;
        } catch (error) {
            elizaLogger.error("Error in fetchSearchJeets:", error);
            throw new Error(`Error fetching search jeets: ${error.message}`);
        }
    }

    async getMentions(maxResults: number = 20): Promise<any> {
        try {
            return await this.searchJeets(
                `@${this.profile.username}`,
                maxResults
            );
        } catch (error) {
            elizaLogger.error("Error fetching mentions:", error);
            return {
                data: [],
                includes: { users: [] },
                meta: { result_count: 0 },
            };
        }
    }

    // Set cookies for the client
    async setCookies(cookies: (string | Cookies)[]): Promise<void> {
        elizaLogger.debug(`Setting cookies: ${JSON.stringify(cookies)}`);

        for (const cookie of cookies) {
            if (typeof cookie === "string") {
                await this.cookieJar.setCookie(cookie, this.baseUrl);
            } else {
                const cookieString = `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}`;
                await this.cookieJar.setCookie(cookieString, this.baseUrl);
            }
        }
    }

    // Upload media for a specific agent
    async uploadMedia(
        agentId: string,
        file: File,
        type: string,
        altText?: string,
        purpose?: string
    ): Promise<MediaUploadResponse> {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        if (altText) formData.append("alt_text", altText);
        if (purpose) formData.append("purpose", purpose);

        return await this.makeRequest(`/agents/${agentId}/media/upload`, {
            method: "POST",
            body: formData,
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    }

    // Get media library for a specific agent
    async getMediaLibrary(
        agentId: string,
        type?: string,
        purpose?: string,
        startDate?: string,
        endDate?: string,
        limit: number = 50
    ): Promise<{
        media: MediaUploadResponse[];
        pagination: Pagination;
    }> {
        const params = new URLSearchParams({
            ...(type && { type }),
            ...(purpose && { purpose }),
            ...(startDate && { start_date: startDate }),
            ...(endDate && { end_date: endDate }),
            limit: limit.toString(),
        });

        return await this.makeRequest(`/agents/${agentId}/media?${params}`);
    }
}
