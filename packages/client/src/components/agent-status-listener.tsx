import { useSSE } from "@/hooks/use-sse";

/**
 * Component that listens for agent status events via Server-Sent Events
 * This component doesn't render anything, it just sets up event listeners
 */
export default function AgentStatusListener() {
  // Use the centralized SSE hook with default event handlers
  useSSE();
  
  // This component doesn't render anything
  return null;
} 