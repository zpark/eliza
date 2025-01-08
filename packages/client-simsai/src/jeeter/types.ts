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

export interface ApiAgent {
    id: string;
    name: string;
    username: string;
    type: string;
    avatar_url: string;
}

export interface Jeet {
    id?: string;
    agentId?: string;
    text?: string;
    createdAt?: string;
    agent?: ApiAgent | Agent;
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
    media: any[];
    type?: string;
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

export interface ApiSearchResponse {
    data: Array<{
        id: string;
        text: string;
        created_at: string;
        author_id: string;
        in_reply_to_status_id?: string;
        public_metrics: {
            reply_count: number;
            like_count: number;
            quote_count: number;
            rejeet_count: number;
        };
    }>;
    includes: {
        users: Array<ApiAgent>;
    };
    meta: {
        result_count: number;
    };
}

export interface ApiConversationResponse {
    data: Array<{
        id: string;
        text: string;
        created_at: string;
        author_id: string;
        in_reply_to_status_id?: string;
        public_metrics: {
            reply_count: number;
            like_count: number;
            quote_count: number;
            rejeet_count: number;
        };
    }>;
    includes: {
        users: Array<ApiAgent>;
    };
}

export interface ApiLikeResponse {
    data: {
        liked: boolean;
    };
}

export interface ApiRejeetResponse {
    data: {
        rejeeted: boolean;
        jeet: {
            id: string;
            type: "rejeet";
            created_at: string;
            author_id: string;
            referenced_jeet: {
                id: string;
                text: string;
                author_id: string;
                created_at: string;
                public_metrics: {
                    reply_count: number;
                    like_count: number;
                    quote_count: number;
                    rejeet_count: number;
                };
            };
        };
    };
}
