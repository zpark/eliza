import { Provider, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { GitBookResponse, GitBookClientConfig } from '../types';

function cleanText(text: string): string {
    console.log('📝 Cleaning text input:', text);

    const cleaned = text
        .replace(/<@!?\d+>/g, '')        // Discord mentions
        .replace(/<#\d+>/g, '')          // Discord channels
        .replace(/<@&\d+>/g, '')         // Discord roles
        .replace(/(?:^|\s)@[\w_]+/g, '') // Platform mentions
        .trim();

    console.log('✨ Cleaned text result:', cleaned);
    return cleaned;
}

async function validateQuery(runtime: IAgentRuntime, text: string): Promise<boolean> {
    console.log('🔍 Validating query text:', text);

    // Default keywords
    let keywords = {
        contractQueries: ['contract', 'address'],
        generalQueries: ['how', 'what', 'where', 'explain', 'show', 'list', 'tell'],
        mustInclude: [],
        shouldInclude: []
    };

    let documentTriggers: string[] = [];

    try {
        const gitbookConfig = runtime.character.clientConfig?.gitbook as GitBookClientConfig;
        console.log('📋 GitBook Config:', gitbookConfig);

        if (gitbookConfig) {
            if (gitbookConfig.keywords) {
                keywords = {
                    ...keywords,
                    ...gitbookConfig.keywords
                };
            }
            if (gitbookConfig.documentTriggers) {
                documentTriggers = gitbookConfig.documentTriggers;
            }
        }

        const containsAnyWord = (text: string, words: string[] = []) => {
            return words.length === 0 || words.some(word => {
                if (word.includes(' ')) {
                    return text.includes(word.toLowerCase());
                }
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                return regex.test(text);
            });
        };

        const hasDocTrigger = containsAnyWord(text, documentTriggers);
        const hasContractQuery = containsAnyWord(text, keywords.contractQueries);
        const hasGeneralQuery = containsAnyWord(text, keywords.generalQueries);
        const hasMustInclude = containsAnyWord(text, keywords.mustInclude);

        const validationResults = {
            hasDocTrigger,
            hasContractQuery,
            hasGeneralQuery,
            hasMustInclude,
            text
        };

        console.log('🔍 Validation Results:', validationResults);

        const isValid = (hasDocTrigger || hasContractQuery || hasGeneralQuery) && hasMustInclude;
        console.log('✅ Validation Result:', isValid);
        return isValid;

    } catch (error) {
        console.error("❌ Error in validation:", error);
        return false;
    }
}

export const gitbookProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<string> => {
        console.log('🔄 GitBook Provider executing');

        try {
            const spaceId = runtime.getSetting("GITBOOK_SPACE_ID");
            if (!spaceId) {
                console.error("❌ GitBook Space ID not configured");
                return "";
            }
            console.log('✓ SpaceID configured:', spaceId);

            const text = message.content.text.toLowerCase().trim();
            const isValidQuery = await validateQuery(runtime, text);

            if (!isValidQuery) {
                console.log('⚠️ Query validation failed');
                return "";
            }

            const cleanedQuery = cleanText(message.content.text);

            console.log('📡 Making GitBook API request...');
            const response = await fetch(
                `https://api.gitbook.com/v1/spaces/${spaceId}/search/ask`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        query: cleanedQuery,
                        variables: {}
                    })
                }
            );

            if (!response.ok) {
                console.error('❌ GitBook API error:', response.status);
                return "";
            }

            console.log('✓ GitBook API response received');
            const result: GitBookResponse = await response.json();
            console.log('📄 GitBook Response:', result?.answer?.text || 'No answer text');

            return result.answer?.text || "";
        } catch (error) {
            console.error("❌ Error in GitBook provider:", error);
            return "";
        }
    }
};