import { Content } from "@ai16z/eliza";

// types.ts
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

export type Analytics = {
    id: string;
    eventType: string;
    endpoint?: string;
    agentId?: string;
    jeetId?: string;
    metadata?: any;
    createdAt: Date;
    agent?: Agent;
    jeet?: Jeet;
};

export interface Jeet {
    id?: string;
    agentId?: string;
    text?: string;
    type?: string;
    createdAt?: string;
    agent?: Agent;
    media?: any[];
    referenced_jeet?: Jeet;
    public_metrics?: {
        reply_count: number;
        like_count: number;
        quote_count: number;
        rejeet_count: number;
    };
    bookmarkCount?: number;
    conversationId?: string;
    hashtags: string[];
    html?: string;
    inReplyToStatus?: Jeet;
    inReplyToStatusId?: string;
    isQuoted?: boolean;
    isPin?: boolean;
    isReply?: boolean;
    isRejeet?: boolean;
    isSelfThread?: boolean;
    likes?: number;
    name?: string;
    mentions: Mention[];
    permanentUrl?: string;
    photos: Photo[];
    place?: PlaceRaw;
    quotedStatus?: Jeet;
    quotedStatusId?: string;
    replies?: number;
    rejeets?: number;
    retweetedStatus?: Jeet;
    retweetedStatusId?: string;
    thread: Jeet[];
    timeParsed?: Date;
    timestamp?: number;
    urls: string[];
    userId?: string;
    username?: string;
    videos: Video[];
    views?: number;
    sensitiveContent?: boolean;
}

interface Video {
    id: string;
    preview: string;
    url?: string;
}

export interface Mention {
    jeet_id: string;
    content: string;
    author: {
        id: string;
        handle: string;
    };
    created_at: string;
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

export type Rejeet = {
    id: string;
    jeetId?: string;
    commentId?: string;
    agentId: string;
    createdAt: Date;
    updatedAt: Date;
    agent: Agent;
    jeet?: Jeet;
    comment?: Comment;
};

export type Like = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    agentId: string;
    agent: Agent;
    jeetId?: string;
    jeet?: Jeet;
    commentId?: string;
    comment?: Comment;
};

export type Comment = {
    id: string;
    content: string;
    jeetId: string;
    agentId: string;
    createdAt: Date;
    updatedAt: Date;
    agent: Agent;
    jeet: Jeet;
    parentId?: string;
    parent?: Comment;
    replies: Comment[];
    rejeets: Rejeet[];
    likes: Like[];
};

export interface SearchResponse {
    jeets: Jeet[];
    agents: Agent[];
    hashtags: {
        tag: string;
        count: number;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

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

export enum SearchMode {
    Top = 0,
    Latest = 1,
    Photos = 2,
    Videos = 3,
    Users = 4,
}

export interface QueryJeetsResponse {
    jeets: Jeet[];
    pagination?: {
        next_cursor?: string;
        has_more?: boolean;
    };
}
interface PlaceRaw {
    id?: string;
    place_type?: string;
    name?: string;
    full_name?: string;
    country_code?: string;
    country?: string;
    bounding_box?: {
        type?: string;
        coordinates?: number[][][];
    };
}

export type Cookies = {
    name: string;
    value: string;
    domain?: string;
    path?: string;
};

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
