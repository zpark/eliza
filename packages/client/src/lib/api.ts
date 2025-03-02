import type { Character, Content, UUID } from "@elizaos/core";
import { WorldManager } from "./world-manager";

const BASE_URL = `http://localhost:${import.meta.env.VITE_SERVER_PORT}`;

const fetcher = async ({
    url,
    method,
    body,
    headers,
}: {
    url: string;
    method?: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
    body?: object | FormData;
    headers?: HeadersInit;
}) => {
    const options: RequestInit = {
        method: method ?? "GET",
        headers: headers
            ? headers
            : {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
    };

    if (method === "POST" || method === "PUT" || method === "PATCH") {
        if (body instanceof FormData) {
            if (options.headers && typeof options.headers === 'object') {
                // Create new headers object without Content-Type
                options.headers = Object.fromEntries(
                    Object.entries(options.headers as Record<string, string>)
                        .filter(([key]) => key !== 'Content-Type')
                );
            }
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
    }

    return fetch(`${BASE_URL}${url}`, options).then(async (resp) => {
        const contentType = resp.headers.get('Content-Type');
        if (contentType === "audio/mpeg") {
            return await resp.blob();
        }

        if (!resp.ok) {
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
        }
            
        try {
            return await resp.json();
        } catch (error) {
            console.error("JSON Parse Error:", error);
            return null;
        }
    });
};

export interface RoomResponse {
    id: UUID;
    name: string;
    source: string;
    worldId?: string;
    createdAt?: number;
}

export interface AgentResponse {
    id: UUID;
    enabled?: boolean;
    character: Character;
    status?: 'active' | 'inactive';
}

export interface MessageResponse extends Content {
    id: UUID;
    agentId: UUID;
    userId: UUID;
    roomId: UUID;
    createdAt: number;
}

export interface TranscriptionResponse {
    text: string;
}

export interface AgentStatusUpdateParams {
    agentId: string;
    status: 'active' | 'inactive';
}

export interface AgentStatusResponse extends AgentResponse {
    enabled: boolean;
    status: 'active' | 'inactive';
}

export const apiClient = {
    // Core Agent CRUD Operations
    getAgents: (): Promise<{ agents: AgentResponse[] }> => 
        fetcher({ url: "/agents" }),
    
    getAgent: (agentId: string): Promise<AgentResponse> =>
        fetcher({ url: `/agents/${agentId}` }),
    
    createAgent: (params: { characterPath?: string; characterJson?: Character; remotePath?: string }): Promise<AgentResponse> =>
        fetcher({
            url: "/agents",
            method: "POST",
            body: params,
        }),
    
    updateAgent: (agentId: string, character: Character): Promise<AgentResponse> =>
        fetcher({
            url: `/agents/${agentId}`,
            method: "PUT",
            body: character,
        }),
    
    deleteAgent: (agentId: string): Promise<void> =>
        fetcher({ url: `/agents/${agentId}`, method: "DELETE" }),

    // Agent Status Management
    updateAgentStatus: async ({ agentId, status }: AgentStatusUpdateParams): Promise<AgentStatusResponse> => {
        if (!agentId) {
            throw new Error('Agent ID is required');
        }
        
        if (!['active', 'inactive'].includes(status)) {
            throw new Error("Status must be 'active' or 'inactive'");
        }

        const response = await fetcher({
            url: `/agents/${agentId}/status`,
            method: "PATCH",
            body: { status },
        });

        // Ensure the response matches our expected format
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response from server');
        }

        // Ensure the response has the required fields
        if (!response.id || !response.character || !response.status) {
            throw new Error('Invalid agent status response format');
        }

        return {
            ...response,
            enabled: status === 'active',
            status: status
        };
    },

    // Communication (Messages & Speech)
    sendMessage: (
        agentId: string,
        text: string,
        options?: {
            roomId?: UUID;
            userId?: string;
            userName?: string;
            name?: string;
            worldId?: string;
            file?: File;
        }
    ): Promise<MessageResponse[]> => {
        const worldId = WorldManager.getWorldId();
        
        if (options?.file) {
            const formData = new FormData();
            formData.append("text", text);
            formData.append("file", options.file);
            if (options.roomId) formData.append("roomId", options.roomId);
            if (options.userId) formData.append("userId", options.userId);
            if (options.userName) formData.append("userName", options.userName);
            if (options.name) formData.append("name", options.name);
            formData.append("worldId", worldId);
            
            return fetcher({
                url: `/agents/${agentId}/messages`,
                method: "POST",
                body: formData,
            });
        }

        return fetcher({
            url: `/agents/${agentId}/messages`,
            method: "POST",
            body: {
                text,
                roomId: options?.roomId,
                userId: options?.userId,
                userName: options?.userName,
                name: options?.name,
                worldId
            },
        });
    },

    generateSpeech: (agentId: string, text: string): Promise<Blob> =>
        fetcher({
            url: `/agents/${agentId}/speech/generate`,
            method: "POST",
            body: { text },
            headers: {
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        }),

    speechConversation: (
        agentId: string,
        text: string,
        options?: {
            roomId?: UUID;
            userId?: string;
            userName?: string;
            name?: string;
        }
    ): Promise<Blob> =>
        fetcher({
            url: `/agents/${agentId}/speech/conversation`,
            method: "POST",
            body: {
                text,
                ...options
            },
            headers: {
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        }),

    // Room Management
    getRooms: (agentId: string): Promise<RoomResponse[]> => {
        const worldId = WorldManager.getWorldId();
        return fetcher({
            url: `/agents/${agentId}/rooms`,
            method: "GET",
            body: { worldId }
        });
    },

    createRoom: (
        agentId: string,
        options: {
            name?: string;
            worldId?: string;
            roomId?: UUID;
            userId?: string;
        }
    ): Promise<RoomResponse> => {
        const worldId = WorldManager.getWorldId();
        return fetcher({
            url: `/agents/${agentId}/rooms`,
            method: "POST",
            body: {
                ...options,
                worldId: options.worldId || worldId
            }
        });
    },

    // Audio Processing
    transcribeAudio: (agentId: string, audioFile: File): Promise<TranscriptionResponse> => {
        const formData = new FormData();
        formData.append("file", audioFile);
        return fetcher({
            url: `/agents/${agentId}/transcriptions`,
            method: "POST",
            body: formData,
        });
    },
};
