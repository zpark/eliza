import { type UUID, type Character } from "@elizaos/core";

const BASE_URL = "http://localhost:3000";

const fetcher = async ({
    url,
    method,
    body,
}: {
    url: string;
    method?: "GET" | "POST";
    body?: object;
}) => {
    const options: RequestInit = {
        method: method ?? "GET",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    };

    if (method === "POST" && body) {
        options.body = JSON.stringify(body);
    }

    return fetch(`${BASE_URL}${url}`, options).then(async (resp) => {
        if (resp.ok) {
            return resp.json();
        }

        const errorText = await resp.text();
        console.error("Error: ", errorText);

        let errorMessage = "An error occurred.";
        try {
            const errorObj = JSON.parse(errorText);
            errorMessage = errorObj.message || errorMessage;
        } catch {
            errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
    });
};

export const apiClient = {
    sendMessage: (agentId: string) =>
        fetcher({ url: `/${agentId}/message`, method: "POST" }),
    getAgents: () => fetcher({ url: "/agents" }),
    getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
        fetcher({ url: `/agents/${agentId}` }),
};
