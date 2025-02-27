import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

// Event types that the server can emit
export type SSEEventType = 
  | 'agents:list' 
  | 'agent:started' 
  | 'agent:stopped' 
  | 'agent:updated'
  | 'message:new'
  | 'character:updated'
  | 'character:created'
  | 'character:deleted';

// A more specific type for SSE event data
export interface SSEEventData {
  id?: string;
  name?: string;
  message?: string;
  timestamp?: number;
  status?: string;
  [key: string]: unknown;
}

// Define custom handlers for different event types
type EventHandlers = {
  [key in SSEEventType]?: (data: SSEEventData) => void;
};

/**
 * Hook for Server-Sent Events (SSE) connection with automatic reconnection
 * and support for custom event handlers
 */
export function useSSE(customHandlers?: EventHandlers) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    const setupSSE = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Create the EventSource for SSE
      const baseUrl = `http://localhost:${import.meta.env.VITE_SERVER_PORT}`;
      eventSourceRef.current = new EventSource(`${baseUrl}/events`);
      
      // Handle connection open
      eventSourceRef.current.onopen = () => {
        console.log("[SSE] Connection established");
      };
      
      // Handle connection error with exponential backoff
      let reconnectAttempt = 0;
      eventSourceRef.current.onerror = (error) => {
        console.error("[SSE] Connection error:", error);
        
        // Close the errored connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        
        // Calculate backoff time (max 30 seconds)
        const backoffTime = Math.min(1000 * (1.5 ** reconnectAttempt), 30000);
        reconnectAttempt++;
        
        console.log(`[SSE] Attempting to reconnect in ${backoffTime / 1000} seconds...`);
        
        // Schedule reconnection
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log("[SSE] Reconnecting...");
          setupSSE();
        }, backoffTime);
      };
      
      // Default handlers
      const defaultHandlers: EventHandlers = {
        'agents:list': (data) => {
          console.log("[SSE] Received agents:list update:", data);
          // Directly update the query cache
          queryClient.setQueryData(["agents"], data);
        },
        
        'agent:started': (data) => {
          console.log("[SSE] Received agent:started event:", data);
          toast({
            title: "Agent Started",
            description: data.message || `${data.name} is now running`,
          });
          
          // Update specific agent data if available
          if (data.id) {
            queryClient.invalidateQueries({ queryKey: ["agent", data.id] });
          }
          
          // Update the agents list
          queryClient.invalidateQueries({ queryKey: ["agents"] });
        },
        
        'agent:stopped': (data) => {
          console.log("[SSE] Received agent:stopped event:", data);
          toast({
            title: "Agent Stopped",
            description: data.message || `${data.name} has been stopped`,
          });
          
          // Update specific agent data if available
          if (data.id) {
            queryClient.invalidateQueries({ queryKey: ["agent", data.id] });
          }
          
          // Update the agents list
          queryClient.invalidateQueries({ queryKey: ["agents"] });
        },
        
        'agent:updated': (data) => {
          console.log("[SSE] Received agent:updated event:", data);
          toast({
            title: "Agent Updated",
            description: data.message || `${data.name} has been updated`,
          });
          
          // Update specific agent data if available
          if (data.id) {
            queryClient.invalidateQueries({ queryKey: ["agent", data.id] });
          }
          
          // Update the agents list
          queryClient.invalidateQueries({ queryKey: ["agents"] });
        }
      };
      
      // Combine default and custom handlers
      const handlers = { ...defaultHandlers, ...customHandlers };
      
      // Set up event listeners for all handlers
      Object.entries(handlers).forEach(([eventType, handler]) => {
        if (eventSourceRef.current && handler) {
          eventSourceRef.current.addEventListener(eventType, (event) => {
            try {
              const data = JSON.parse(event.data) as SSEEventData;
              handler(data);
            } catch (error) {
              console.error(`[SSE] Error handling ${eventType} event:`, error);
            }
          });
        }
      });
    };
    
    // Initial setup
    setupSSE();
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log("[SSE] Closing connection on unmount");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [queryClient, toast, customHandlers]);
} 