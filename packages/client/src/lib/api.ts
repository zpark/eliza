import type { Character, UUID } from "@elizaos/core";
import { WorldManager } from "./world-manager";

const BASE_URL = `http://localhost:${import.meta.env.VITE_SERVER_PORT}`;

const fetcher = async ({
    url,
    method,
    body,
    headers,
}: {
    url: string;
    method?: "GET" | "POST" | "DELETE" | "PUT";
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

    if (method === "POST" || method === "PUT") {
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

export const apiClient = {
    sendMessage: (
        agentId: string,
        message: string,
        selectedFile?: File | null,
        roomId?: UUID
    ) => {
        const worldId = WorldManager.getWorldId();
        
        if (selectedFile) {
            // Use FormData only when there's a file
            const formData = new FormData();
            formData.append("text", message);
            formData.append("user", "user");
            formData.append("file", selectedFile);
            // Add roomId if provided
            if (roomId) {
                formData.append("roomId", roomId);
            }
            // Add worldId
            formData.append("worldId", worldId);
            
            return fetcher({
                url: `/agents/${agentId}/message`,
                method: "POST",
                body: formData,
            });
        }
            // Use JSON when there's no file
            return fetcher({
                url: `/agents/${agentId}/message`,
                method: "POST",
                body: {
                    text: message,
                    user: "user",
                    roomId: roomId || undefined,
                    worldId
                },
            });
    },
    getAgents: () => fetcher({ url: "/agents" }),
    getAgent: (agentId: string): Promise<{ id: UUID; character: Character; enabled: boolean }> =>
        fetcher({ url: `/agents/${agentId}` }),
    tts: (agentId: string, text: string) =>
        fetcher({
            url: `/agents/${agentId}/speech/generate`,
            method: "POST",
            body: {
                text,
            },
            headers: {
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        }),
    whisper: async (agentId: string, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        return fetcher({
            url: `/agents/${agentId}/transcriptions`,
            method: "POST",
            body: formData,
        });
    },
    speechConversation: async (agentId: string, text: string, options?: { roomId?: string; userId?: string; userName?: string; name?: string }) => {
        return fetcher({
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
        });
    },
    deleteAgent: (agentId: string): Promise<{ success: boolean }> =>
        fetcher({ url: `/agents/${agentId}`, method: "DELETE" }),
    updateAgent: (agentId: string, character: Character) =>
        fetcher({
            url: `/agents/${agentId}`,
            method: "PUT",
            body: character,
        }),
    createAgent: (params: { characterPath?: string; characterJson?: Character }) =>
        fetcher({
            url: "/agents/",
            method: "POST",
            body: params,
        }),
    startAgent: (params: { characterPath?: string; characterJson?: Character }) =>
        fetcher({
            url: "/agents/start",
            method: "POST",
            body: params,
        }),
    startAgentByName: (characterName: string) =>
        fetcher({
            url: `/agents/start/${characterName}`,
            method: "POST",
        }),
    stopAgent: (agentId: string) => {
        return fetcher({
            url: `/agents/${agentId}/stop`,
            method: "POST",
        });
    },
    removeAgent: (agentId: string) => {
        return fetcher({
            url: `/agents/${agentId}`,
            method: "DELETE",
        });
    },
    getMemories: (agentId: string, roomId: string, options?: { limit?: number; before?: number }) => {
        const worldId = WorldManager.getWorldId();
        return fetcher({ 
            url: `/agents/${agentId}/${roomId}/memories`,
            method: "GET",
            body: { worldId, ...options }
        });
    },
    
    // Room-related routes
    getRooms: (agentId: string) => {
        const worldId = WorldManager.getWorldId();
        return fetcher({ 
            url: `/agents/${agentId}/rooms`,
            method: "GET",
            body: { worldId }
        });
    },
    
    createRoom: (agentId: string, roomName: string) => {
        const worldId = WorldManager.getWorldId();
        return fetcher({
            url: `/agents/${agentId}/rooms`,
            method: "POST",
            body: {
                name: roomName,
                worldId
            }
        });
    },
    
};
