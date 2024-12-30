const CHAIN_SLUG_TO_CHAIN_ID = {
    testnet: "allora-testnet-1",
    mainnet: "allora-mainnet-1",
};
const DEFAULT_CHAIN_SLUG = "testnet";

export interface AlloraTopic {
    topic_id: number;
    topic_name: string;
    description?: string | null;
    epoch_length: number;
    ground_truth_lag: number;
    loss_method: string;
    worker_submission_window: number;
    worker_count: number;
    reputer_count: number;
    total_staked_allo: number;
    total_emissions_allo: number;
    is_active: boolean | null;
    updated_at: string;
}

export interface AlloraInference {
    signature: string;
    inference_data: {
        network_inference: string;
        network_inference_normalized: string;
        confidence_interval_percentiles: string[];
        confidence_interval_percentiles_normalized: string[];
        confidence_interval_values: string[];
        confidence_interval_values_normalized: string[];
        topic_id: string;
        timestamp: number;
        extra_data: string;
    };
}

export interface TopicsResponse {
    topics: AlloraTopic[];
    continuation_token?: string | null;
}

export interface AlloraAPIResponse<T> {
    request_id: string;
    status: boolean;
    apiResponseMessage?: string;
    data: T;
}

export class AlloraAPIClient {
    private apiKey: string;
    private baseApiUrl: string;
    private chainId: string;

    constructor(
        chainSlug: string = DEFAULT_CHAIN_SLUG,
        apiKey: string = "",
        baseApiUrl: string = "https://api.upshot.xyz/v2"
    ) {
        this.chainId = CHAIN_SLUG_TO_CHAIN_ID[chainSlug];
        this.apiKey = apiKey;
        this.baseApiUrl = baseApiUrl;
    }

    async getAllTopics(): Promise<AlloraTopic[]> {
        const allTopics: AlloraTopic[] = [];
        let continuationToken: string | null = null;

        do {
            const response = await this.fetchApiResponse<TopicsResponse>(
                `allora/${this.chainId}/topics`
            );

            if (!response.status) {
                throw new Error(
                    `Failed to fetch topics.${response.apiResponseMessage || ""}`
                );
            }

            allTopics.push(...response.data.topics);
            continuationToken = response.data.continuation_token;
        } while (continuationToken);

        return allTopics;
    }

    async getInference(topicId: string): Promise<AlloraInference> {
        const response = await this.fetchApiResponse<AlloraInference>(
            `allora/consumer/ethereum-11155111?allora_topic_id=${topicId}&inference_value_type=uint256`
        );

        if (!response.status) {
            throw new Error(
                `Failed to fetch inference. ${response.apiResponseMessage || ""}`
            );
        }

        return response.data;
    }

    private async fetchApiResponse<T>(
        requestUrl: string
    ): Promise<AlloraAPIResponse<T>> {
        const baseUrl = this.baseApiUrl.endsWith("/")
            ? this.baseApiUrl
            : this.baseApiUrl + "/";
        const endpoint = requestUrl.startsWith("/")
            ? requestUrl.slice(1)
            : requestUrl;

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
            },
        });

        return response.json();
    }
}
