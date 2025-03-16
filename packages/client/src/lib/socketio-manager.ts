import { SOCKET_MESSAGE_TYPE } from "@elizaos/core";
import EventEmitter from 'eventemitter3';
import { io, type Socket } from 'socket.io-client';
import { apiClient } from "./api";
import { WorldManager } from "./world-manager";

const BASE_URL = `http://localhost:${import.meta.env.VITE_SERVER_PORT}`;

type MessagePayload = Record<string, any>;

class SocketIOManager extends EventEmitter {
  private static instance: SocketIOManager | null = null;
  private sockets: Map<string, Socket>;
  private readyPromises: Map<string, Promise<void>>;
  private resolveReadyMap: Map<string, () => void>;
  
  private constructor() {
    super();
    this.sockets = new Map();
    this.readyPromises = new Map();
    this.resolveReadyMap = new Map();
  }

  public static getInstance(): SocketIOManager {
    if (!SocketIOManager.instance) {
      SocketIOManager.instance = new SocketIOManager();
    }
    return SocketIOManager.instance;
  }

  public getSocketId (agentId: string, roomId: string) {
    return `${agentId}:${roomId}`;
  }

  connect(agentId: string, roomId: string): void {

    const socketId = this.getSocketId(agentId, roomId);

    if (this.sockets.has(socketId)) {
      console.warn(`[SocketIO] Socket for socket ${socketId} already exists.`);
      return;
    }

    const socket = io(BASE_URL, {
      query: {
        agentId,
        roomId
      },
      autoConnect: true,
      reconnection: true
    });

    const readyPromise = new Promise<void>((resolve) => {
      this.resolveReadyMap.set(socketId, resolve);
    });
    this.readyPromises.set(socketId, readyPromise);


    socket.on('connect', () => {
      console.log(`[SocketIO] Connected for socket ${socketId}`);
      this.resolveReadyMap.get(socketId)?.();
      const data = {
        type: SOCKET_MESSAGE_TYPE.ROOM_JOINING,
        payload: {
          agentId,
          roomId,
        }
      };
      this.sendMessage(socketId, data);
    });

    socket.on('message', async (messageData) => {
      console.log(`[SocketIO] Message for agent ${agentId}:`, messageData, messageData.type);

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
    });

    socket.on('connect_error', (error) => {
      console.error(`[SocketIO] Connection error for agent ${socketId}:`, error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SocketIO] Disconnected for agent ${socketId}. Reason:`, reason);
      
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    this.sockets.set(socketId, socket);
  }

  async sendMessage(socketId: string, message: MessagePayload): Promise<void> {
    const socket = this.sockets.get(socketId);
    const readyPromise = this.readyPromises.get(socketId);

    if (!socket) {
      console.warn(`[SocketIO] Cannot send message, Socket for socket ${socketId} does not exist.`);
      return;
    }

    await readyPromise;

    if (socket.connected) {
      socket.emit('message', message);
    } else {
      console.warn(`[SocketIO] Socket for socket ${socketId} is not connected.`);
    }
  }

  private cleanupSocket(socketId: string): void {
    this.sockets.delete(socketId);
    this.readyPromises.delete(socketId);
    this.resolveReadyMap.delete(socketId);
  }

  handleBroadcastMessage(senderId: string, senderName: string, text: string, roomId: string, source: string) {
    console.log(`[SocketIO] Broadcasting: ${senderId} sent "${text}" to room ${roomId}`)
    
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
      socket.disconnect();
      this.cleanupSocket(socketId);
      console.log(`[SocketIO] Socket for socket ${socketId} disconnected.`);
    } else {
      console.warn(`[SocketIO] No Socket found for socket ${socketId}.`);
    }
  }

  disconnectAll(): void {
    this.sockets.forEach((socket, socketId) => {
      console.log(`[SocketIO] Closing Socket for socket ${socketId}`);
      
      if (socket.connected) {
        socket.disconnect();
        this.cleanupSocket(socketId);
      } else {
        this.cleanupSocket(socketId);
        console.warn(`[SocketIO] Socket for socket ${socketId} is already disconnected.`);
      }
    });
  }
}

export default SocketIOManager;
