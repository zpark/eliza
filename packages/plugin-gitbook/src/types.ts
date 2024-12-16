// Keywords configuration interface
export interface GitBookKeywords {
    contractQueries?: string[];
    generalQueries?: string[];
    mustInclude?: string[];
    shouldInclude?: string[];
}

// Client configuration in character.json
export interface GitBookClientConfig {
    keywords?: GitBookKeywords;
    documentTriggers?: string[];
}

// GitBook API response type
export interface GitBookResponse {
    answer?: {
        text: string;
    };
    error?: string;
}