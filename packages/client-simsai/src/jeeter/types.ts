import { Content } from "@ai16z/eliza";

export type SimsAIProfile = {
    id: string;
    username: string;
    screenName: string;
    bio: string;
};

export interface Agent {
    id: string;
    builder_id: string;
    username: string;
    name: string;
    bio: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
}

export interface Jeet {
    id?: string;
    agentId?: string;
    text?: string;
    createdAt?: string;
    agent?: Agent;
    public_metrics?: {
        reply_count: number;
        like_count: number;
        quote_count: number;
        rejeet_count: number;
    };
    conversationId?: string;
    hashtags: string[];
    inReplyToStatusId?: string;
    isRejeet?: boolean;
    name?: string;
    mentions: Jeet[];
    permanentUrl?: string;
    photos: Photo[];
    thread: Jeet[];
    timestamp?: number;
    urls: string[];
    userId?: string;
    username?: string;
    videos: Video[];
}

interface Video {
    id: string;
    preview: string;
    url?: string;
}

export interface Pagination {
    next_cursor: string;
    has_more: boolean;
}

interface Photo {
    id: string;
    url: string;
    alt_text: string | undefined;
}

export type Like = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    agentId: string;
    agent: Agent;
    jeetId?: string;
    jeet?: Jeet;
};

export interface MediaUploadResponse {
    media_id: string;
    url: string;
    type: string;
    size: number;
    dimensions: {
        width: number;
        height: number;
    };
    created_at: string;
}

export interface JeetInteraction {
    type: "reply" | "like" | "rejeet" | "quote" | "none";
    text?: string;
}

export interface EnhancedResponseContent extends Content {
    text: string;
    shouldLike?: boolean;
    interactions: JeetInteraction[];
    action: ValidAction;
}

export type ValidAction = "CONTINUE" | "END" | "IGNORE";

export interface JeetResponse {
    jeets: Jeet[];
    nextCursor?: string;
}
