import {
    Service,
    IWebSearchService,
    ServiceType,
    IAgentRuntime,
    SearchResponse,
    SearchOptions,
} from "@elizaos/core";
import { tavily } from "@tavily/core";

export class WebSearchService extends Service implements IWebSearchService {
    static serviceType: ServiceType = ServiceType.WEB_SEARCH;

    async initialize(_runtime: IAgentRuntime): Promise<void> {}

    getInstance(): IWebSearchService {
        return WebSearchService.getInstance();
    }

    async search(
        query: string,
        runtime: IAgentRuntime,
        options?: SearchOptions,
    ): Promise<SearchResponse> {
        try {
            const apiKey = runtime.getSetting("TAVILY_API_KEY") as string;
            if (!apiKey) {
                throw new Error("TAVILY_API_KEY is not set");
            }

            const tvly = tavily({ apiKey });
            const response = await tvly.search(query, {
                includeAnswer: options?.includeAnswer || true,
                maxResults: options?.limit || 3,
                topic: options?.type || "general",
                searchDepth: options?.searchDepth || "basic",
                includeImages: options?.includeImages || false,
                days: options?.days || 3,
            });

            return response;
        } catch (error) {
            console.error("Web search error:", error);
            throw error;
        }
    }
}
