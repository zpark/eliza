import { elizaLogger } from '@elizaos/core';
import axios from 'axios';
import { getApiConfig } from '../environment';

interface CategoryItem {
    category_id: string;
    name: string;
}

let categoriesCache: CategoryItem[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export async function fetchCategories(config: any): Promise<CategoryItem[]> {
    const now = Date.now();

    // Return cached categories if they're still valid
    if (categoriesCache && (now - lastFetchTime < CACHE_DURATION)) {
        return categoriesCache;
    }

    try {
        const { baseUrl, apiKey } = getApiConfig(config);
        const response = await axios.get<CategoryItem[]>(
            `${baseUrl}/coins/categories/list`,
            {
                headers: {
                    'accept': 'application/json',
                    'x-cg-pro-api-key': apiKey
                }
            }
        );

        categoriesCache = response.data;
        lastFetchTime = now;
        return response.data;
    } catch (error) {
        elizaLogger.error('Error fetching categories:', error);
        // If cache exists, return it even if expired
        if (categoriesCache) {
            return categoriesCache;
        }
        throw error;
    }
}

export function formatCategory(category: string | undefined, categories: CategoryItem[]): string | undefined {
    if (!category) return undefined;

    const normalizedInput = category.toLowerCase().trim();

    // First try to find exact match by category_id
    const exactMatch = categories.find(c => c.category_id === normalizedInput);
    if (exactMatch) {
        return exactMatch.category_id;
    }

    // Then try to find match by name
    const nameMatch = categories.find(c =>
        c.name.toLowerCase() === normalizedInput ||
        c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalizedInput
    );
    if (nameMatch) {
        return nameMatch.category_id;
    }

    // Try to find partial matches
    const partialMatch = categories.find(c =>
        c.name.toLowerCase().includes(normalizedInput) ||
        c.category_id.includes(normalizedInput)
    );
    if (partialMatch) {
        return partialMatch.category_id;
    }

    return undefined;
}