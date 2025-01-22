import { Provider } from "@elizaos/eliza";

export interface SunoConfig {
    apiKey: string;
    baseUrl?: string;
}

export class SunoProvider implements Provider {
    private apiKey: string;
    private baseUrl: string;

    constructor(config: SunoConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.suno.ai/v1';
    }

    async request(endpoint: string, options: RequestInit = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            throw new Error(`Suno API error: ${response.statusText}`);
        }

        return response.json();
    }
}

export const sunoProvider = new SunoProvider({ apiKey: process.env.SUNO_API_KEY || '' });

export interface GenerateParams {
    prompt: string;
    duration?: number;
    temperature?: number;
    topK?: number;
    topP?: number;
    classifier_free_guidance?: number;
}

export interface CustomGenerateParams extends GenerateParams {
    reference_audio?: string;
    style?: string;
    bpm?: number;
    key?: string;
    mode?: string;
}

export interface ExtendParams {
    audio_id: string;
    duration: number;
}

export interface GenerationResponse {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    audio_url?: string;
    error?: string;
}