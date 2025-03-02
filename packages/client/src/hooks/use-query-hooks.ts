import { apiClient } from '@/lib/api';
import { WorldManager } from '@/lib/world-manager';
import type { Character, Content, Media, UUID } from '@elizaos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from './use-toast';

// Generate a unique ID for messages
function generateMessageId(msg: Memory | TransformedMessage): string {
  const timestamp = typeof msg.createdAt === 'number' ? msg.createdAt : 0;
  const user = 'userId' in msg ? msg.userId : msg.user;
  const text = 'content' in msg && typeof msg.content === 'object' ? 
    msg.content.text : 
    'text' in msg ? msg.text : '';
  
  return `${timestamp}-${user}-${text.substring(0, 20)}`;
}

// Define the ContentWithUser type
type ContentWithUser = Content & {
  user: string;
  createdAt: number;
  isLoading?: boolean;
  worldId?: string;
  id?: string; // Add optional ID field
};

// Define the Memory type needed for the useMessages hook
type Memory = {
  userId: string;
  content: {
    text: string;
    attachments?: Media[];
    source?: string;
    action?: string;
  };
  createdAt: number;
  worldId?: string;
};

// Define a type for transformed messages to avoid type mismatches
type TransformedMessage = {
  text: string;
  user: string;
  createdAt: number;
  attachments?: Media[];
  source?: string;
  action?: string;
  worldId?: string;
  id: string; // Add ID field
};

// Constants for stale times
export const STALE_TIMES = {
  FREQUENT: 30 * 1000, // 30 seconds - for data that changes often
  STANDARD: 2 * 60 * 1000, // 2 minutes - default
  RARE: 10 * 60 * 1000, // 10 minutes - for rarely changing data
  NEVER: Number.POSITIVE_INFINITY // Only refetch on explicit invalidation
};

// Network Information API interface
interface NetworkInformation {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  saveData: boolean;
  [key: string]: unknown;
}

// Network status detection for smart polling
const useNetworkStatus = () => {
  // Get navigator.connection if available (Network Information API)
  const connection = 
    typeof navigator !== 'undefined' && 'connection' in navigator
      ? (navigator as Navigator & { connection: NetworkInformation }).connection
      : null;
      
  // Return the effective connection type or a default value
  return {
    isOffline: typeof navigator !== 'undefined' && !navigator.onLine,
    effectiveType: connection?.effectiveType || 'unknown',
    saveData: connection?.saveData || false
  };
};

// Add AgentData interface
interface AgentData {
  id: string;
  character: { 
    name: string;
    // Include other character properties as needed
  };
  enabled: boolean;
}

// Hook for fetching agents with smart polling
export function useAgents(options = {}) {
  const network = useNetworkStatus();
  
  return useQuery<{ agents: AgentData[] }>({
    queryKey: ['agents'],
    queryFn: () => apiClient.getAgents(),
    staleTime: STALE_TIMES.FREQUENT,
    refetchInterval: !network.isOffline ? STALE_TIMES.FREQUENT : false,
    refetchIntervalInBackground: false,
    ...(!network.isOffline && network.effectiveType === 'slow-2g' && {
      refetchInterval: STALE_TIMES.STANDARD
    }),
    ...options
  });
}

// Hook for fetching a specific agent with smart polling
export function useAgent(agentId: UUID | undefined | null, options = {}) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => apiClient.getAgent(agentId || ''),
    staleTime: STALE_TIMES.FREQUENT,
    enabled: Boolean(agentId),
    refetchInterval: !network.isOffline && Boolean(agentId) ? STALE_TIMES.FREQUENT : false,
    refetchIntervalInBackground: false,
    ...(!network.isOffline && network.effectiveType === 'slow-2g' && {
      refetchInterval: STALE_TIMES.STANDARD
    }),
    ...options
  });
}

// Hook for managing agent status
export function useAgentStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ agentId, status }: { agentId: string; status: 'active' | 'inactive' }) => 
      apiClient.updateAgentStatus({ agentId, status }),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', variables.agentId] });
      
      toast({
        title: variables.status === 'active' ? 'Agent Started' : 'Agent Stopped',
        description: `Agent ${data.character.name} is now ${variables.status}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update agent status',
        variant: 'destructive',
      });
    }
  });
}

// Hook for sending messages
export function useSendMessage(agentId: UUID) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const worldId = WorldManager.getWorldId();

  return useMutation({
    mutationFn: ({ 
      text, 
      file,
      roomId,
      userId,
      userName,
      name 
    }: { 
      text: string;
      file?: File;
      roomId?: UUID;
      userId?: string;
      userName?: string;
      name?: string;
    }) => apiClient.sendMessage(agentId, text, {
      file,
      roomId,
      userId,
      userName,
      name,
      worldId
    }),
    onSuccess: (response, variables) => {
      // Update messages in cache
      queryClient.setQueryData(
        ['messages', agentId, variables.roomId || 'default', worldId],
        (old: ContentWithUser[] = []) => [
          ...old.filter(msg => !msg.isLoading),
          ...Array.isArray(response) ? response : [response]
        ]
      );
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    }
  });
}

// Hook for room management
export function useRooms(agentId: UUID) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['rooms', agentId],
    queryFn: () => apiClient.getRooms(agentId),
    staleTime: STALE_TIMES.STANDARD,
    refetchInterval: !network.isOffline ? STALE_TIMES.STANDARD : false,
    enabled: Boolean(agentId)
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ 
      agentId, 
      name,
      worldId,
      roomId,
      userId 
    }: {
      agentId: string;
      name?: string;
      worldId?: string;
      roomId?: UUID;
      userId?: string;
    }) => apiClient.createRoom(agentId, { name, worldId, roomId, userId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.agentId] });
      toast({
        title: 'Room Created',
        description: 'New chat room has been created',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create room',
        variant: 'destructive',
      });
    }
  });
}

// Hook for fetching messages directly for a specific agent without requiring a room
export function useAgentMessages(agentId: UUID) {
  const queryClient = useQueryClient();
  const worldId = WorldManager.getWorldId();
  
  // Get messages from cache or set default empty array
  const messages = queryClient.getQueryData<ContentWithUser[]>(
    ['messages', agentId, worldId]
  ) || [];
  
  return {
    messages
  };
}

// The original useMessages hook updated for new API
export function useMessages(agentId: UUID, roomId: UUID): {
  data: TransformedMessage[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasOlderMessages: boolean;
  isLoadingMore: boolean;
} {
  const queryClient = useQueryClient();
  const worldId = WorldManager.getWorldId();
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  
  // Initial fetch of messages
  const messagesQuery = useQuery({
    queryKey: ['messages', agentId, roomId, worldId],
    queryFn: async () => {
      // Since we don't have a direct getMessages endpoint anymore,
      // we'll return the cached messages or an empty array
      return queryClient.getQueryData<ContentWithUser[]>(
        ['messages', agentId, roomId, worldId]
      ) || [];
    },
    staleTime: STALE_TIMES.FREQUENT
  });

  // Transform messages to the expected format
  const transformedMessages = messagesQuery.data?.map((msg: ContentWithUser): TransformedMessage => ({
    text: msg.text,
    user: msg.user,
    createdAt: msg.createdAt,
    attachments: msg.attachments,
    source: msg.source,
    action: msg.action,
    worldId: msg.worldId,
    id: msg.id || generateMessageId({ ...msg, id: `${msg.createdAt}-${msg.user}` }) // Ensure id is always present
  }));

  return {
    data: transformedMessages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,
    hasOlderMessages: hasMoreMessages,
    isLoadingMore
  };
}
