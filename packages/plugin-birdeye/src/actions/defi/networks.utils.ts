export interface NetworksResponse {
    success: boolean;
    data: string[];
}

// Constants for keyword matching
export const NETWORK_KEYWORDS = [
    "supported networks",
    "available networks",
    "supported chains",
    "available chains",
    "which networks",
    "which chains",
    "list networks",
    "list chains",
    "show networks",
    "show chains",
    "network support",
    "chain support",
] as const;

// Helper function to check if text contains network-related keywords
export const containsNetworkKeyword = (text: string): boolean => {
    return NETWORK_KEYWORDS.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
};
