import EventEmitter from 'eventemitter3';
import { SOCKET_MESSAGE_TYPE } from "@elizaos/core";
import { apiClient } from "./api";
import { WorldManager } from "./world-manager";

const BASE_URL = `ws://localhost:${import.meta.env.VITE_SERVER_PORT}`;

type MessagePayload = Record<string, any>;

class WebSocketsManager extends EventEmitter {
  private static instance: WebSocketsManager | null = null;
  private sockets: Map<string, WebSocket>;
  private readyPromises: Map<string, Promise<void>>;
  private resolveReadyMap: Map<string, () => void>;
  
  private constructor() {
    super();
    this.sockets = new Map();
    this.readyPromises = new Map();
    this.resolveReadyMap = new Map();
    
  }

  public static getInstance(): WebSocketsManager {
    if (!WebSocketsManager.instance) {
      WebSocketsManager.instance = new WebSocketsManager();
    }
    return WebSocketsManager.instance;
  }

  public getSocketId (agentId: string, roomId: string) {
    return `${agentId}:${roomId}`;
  }

  connect(agentId: string, roomId: string): void {
    const socketId = this.getSocketId(agentId, roomId);

    if (this.sockets.has(socketId)) {
      console.warn(`[WebSocket Client] WebSocket for socket ${socketId} already exists.`);
      return;
    }

    const socket = new WebSocket(BASE_URL);

    const readyPromise = new Promise<void>((resolve) => {
      this.resolveReadyMap.set(socketId, resolve);
    });
    this.readyPromises.set(socketId, readyPromise);

    socket.onopen = () => {
      console.log(`[WebSocket Client] WebSocket connected for socket ${socketId}`);
      this.resolveReadyMap.get(socketId)?.();
      const data = {
        type: SOCKET_MESSAGE_TYPE.ROOM_JOINING,
        payload: {
          agentId,
          roomId,
        }
      };
      this.sendMessage(socketId, data);
    };

    socket.onmessage = async (event: MessageEvent) => {
      const messageData = JSON.parse(event.data);
      console.log(`[WebSocket Client] Message for agent ${agentId}:`, messageData, messageData.type);

      const payload = messageData.payload;

      if (messageData.type === SOCKET_MESSAGE_TYPE.SEND_MESSAGE) {
        const response = await apiClient.getAgentCompletion(
          agentId,
          payload.senderId,
          payload.message,
          payload.roomId,
          payload.source,
        );

        if (response?.data?.message?.text) {
          this.handleBroadcastMessage(
            agentId, 
            response?.data?.name,
            response.data.message.text, 
            response.data.roomId,
            response.data.source,
          );
        }
      }
    };

    socket.onerror = (error: Event) => {
      console.error(`[WebSocket Client] WebSocket error for socket ${socketId}:`, error);
    };

    socket.onclose = (event: CloseEvent) => {
      console.log(`[WebSocket Client] WebSocket closed for socket ${socketId}. Reason:`, event.reason);

      if (this.sockets.has(socketId)) {
        console.warn(`[WebSocket Client] Unexpected WebSocket closure for socket ${socketId}, attempting to reconnect...`);
        this.cleanupWebSocket(socketId);

        setTimeout(() => {
          this.connect(socketId, roomId);
        }, 3000);
        
      } else {
        this.cleanupWebSocket(socketId);
      }
    };

    this.sockets.set(socketId, socket);
  }

  async sendMessage(socketId: string, message: MessagePayload): Promise<void> {
    const socket = this.sockets.get(socketId);
    const readyPromise = this.readyPromises.get(socketId);

    if (!socket) {
      console.warn(`[WebSocket Client] Cannot send message, WebSocket for socket ${socketId} does not exist.`);
      return;
    }

    await readyPromise;

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn(`[WebSocket Client] WebSocket for socket ${socketId} is not open.`);
    }
  }

  private cleanupWebSocket(socketId: string): void {
    this.sockets.delete(socketId);
    this.readyPromises.delete(socketId);
    this.resolveReadyMap.delete(socketId);
  }

  handleBroadcastMessage(senderId: string, senderName: string, text: string, roomId: string, source: string) {
    console.log(`[WebSocket Client] broadcast: ${senderId} broadcast ${text} to ${roomId}`)
    
    this.emit("messageBroadcast", { senderId, senderName, text, roomId, createdAt: Date.now(), source});
    
    const socketId = this.getSocketId(senderId, roomId);
    this.sendMessage(socketId, {
      type: SOCKET_MESSAGE_TYPE.SEND_MESSAGE,
      payload: {
        senderId,
        senderName,
        message: text,
        roomId,
        worldId: WorldManager.getWorldId(),
        source,
      }
    })

  }

  disconnect(socketId: string): void {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.close();
      this.sockets.delete(socketId);
      this.readyPromises.delete(socketId);
      this.resolveReadyMap.delete(socketId);
      console.log(`[WebSocket Client] WebSocket for socket ${socketId} disconnected.`);
    } else {
      console.warn(`[WebSocket Client] No WebSocket found for socket ${socketId}.`);
    }
  }

  disconnectAll(): void {
    this.sockets.forEach((socket, socketId) => {
      console.log(`[WebSocket Client] Closing WebSocket for socket ${socketId}`);
      
      if (socket.readyState === WebSocket.OPEN) {
        this.cleanupWebSocket(socketId);
        socket.close();
      } else {
        this.cleanupWebSocket(socketId);
        console.warn(`[WebSocket Client] WebSocket for socket ${socketId} is already closed or closing.`);
      }
    });
  }
  
  
}

export default WebSocketsManager;
