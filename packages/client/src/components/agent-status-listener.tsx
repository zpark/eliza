import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Component that listens for agent status events via Server-Sent Events
 * This component doesn't render anything, it just sets up event listeners
 */
export default function AgentStatusListener() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  
  useEffect(() => {
    // Create the EventSource for SSE
    const baseUrl = `http://localhost:${import.meta.env.VITE_SERVER_PORT}`;
    eventSourceRef.current = new EventSource(`${baseUrl}/events`);
    
    // Handle connection open
    eventSourceRef.current.onopen = () => {
      console.log("SSE connection established");
    };
    
    // Handle connection error
    eventSourceRef.current.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Attempt to reconnect after 5 seconds
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setTimeout(() => {
          eventSourceRef.current = new EventSource(`${baseUrl}/events`);
        }, 5000);
      }
    };
    
    // Handle agents list update event
    eventSourceRef.current.addEventListener("agents:list", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received agents:list update:", data);
        
        // Directly update the agents query data without refetching
        queryClient.setQueryData(["agents"], data);
      } catch (error) {
        console.error("Error parsing agents:list event data:", error);
      }
    });
    
    // Handle agent started event
    eventSourceRef.current.addEventListener("agent:started", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received agent:started event:", data);
        
        toast({
          title: "Agent Started",
          description: data.message || `${data.name} is now running`,
          variant: "default",
        });
        
        // For individual agent data, we can still invalidate
        if (data.id) {
          queryClient.invalidateQueries(["agent", data.id]);
        }
      } catch (error) {
        console.error("Error parsing agent:started event data:", error);
      }
    });
    
    // Handle agent stopped event
    eventSourceRef.current.addEventListener("agent:stopped", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received agent:stopped event:", data);
        
        // Enhanced toast with more details if available
        toast({
          title: "Agent Stopped",
          description: data.message || `${data.name} has been stopped`,
          variant: "default",
        });
        
        // For individual agent data, we can still invalidate
        if (data.id) {
          queryClient.invalidateQueries(["agent", data.id]);
        }
      } catch (error) {
        console.error("Error parsing agent:stopped event data:", error);
      }
    });
    
    // Handle agent updated event
    eventSourceRef.current.addEventListener("agent:updated", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received agent:updated event:", data);
        
        toast({
          title: "Agent Updated",
          description: data.message || `${data.name} has been updated and restarted`,
          variant: "default",
        });
        
        // For individual agent data, we can still invalidate
        if (data.id) {
          queryClient.invalidateQueries(["agent", data.id]);
        }
      } catch (error) {
        console.error("Error parsing agent:updated event data:", error);
      }
    });
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log("Closing SSE connection");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [toast, queryClient]);
  
  // This component doesn't render anything
  return null;
} 