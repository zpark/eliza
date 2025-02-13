import { ClientInstance } from "@elizaos/core";
import { ClientBase } from "./base";
import { TwitterInteractionClient } from "./interactions";
import { TwitterPostClient } from "./post";
import { TwitterSpaceClient } from "./spaces";

export type MediaData = {
    data: Buffer;
    mediaType: string;
};

export interface ActionResponse {
    like: boolean;
    retweet: boolean;
    quote?: boolean;
    reply?: boolean;
}

export enum ActionTimelineType {
    ForYou = "foryou",
    Following = "following",
}

export interface ITwitterClient extends ClientInstance {
    client: ClientBase;
    post: TwitterPostClient;
    interaction: TwitterInteractionClient;
    space?: TwitterSpaceClient;
}