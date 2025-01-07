import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { InstagramConfig } from "../environment";
import { MediaItem } from "../types";
import { getIgClient } from "./state";

export async function fetchRecentMedia(
    runtime: IAgentRuntime,
    config: InstagramConfig,
    count: number = 10
  ): Promise<MediaItem[]> {
    const ig = getIgClient();

    try {
      const feed = ig.feed.user(ig.state.cookieUserId);
      const items = await feed.items();

      return items.slice(0, count).map(item => ({
        id: item.id,
        mediaType: item.media_type as MediaItem['mediaType'],
        mediaUrl: item.media_url,
        thumbnailUrl: item.thumbnail_url,
        permalink: item.permalink,
        caption: item.caption?.text,
        timestamp: item.timestamp,
        children: item.children?.map(child => ({
          id: child.id,
          mediaType: child.media_type as MediaItem['mediaType'],
          mediaUrl: child.media_url,
          thumbnailUrl: child.thumbnail_url,
          permalink: child.permalink,
          timestamp: child.timestamp
        }))
      }));
    } catch (error) {
      elizaLogger.error('Error fetching recent media:', error);
      throw error;
    }
  }