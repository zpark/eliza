import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useToast } from './use-toast';
import type { UUID, Character } from '@elizaos/core';

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

// Hook for fetching agents with smart polling
export function useAgents(options = {}) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.getAgents(),
    staleTime: STALE_TIMES.FREQUENT, // Use shorter stale time for real-time data
    // Use more frequent polling for real-time updates
    refetchInterval: !network.isOffline 
      ? STALE_TIMES.FREQUENT 
      : false,
    // Disable polling when the tab is not active
    refetchIntervalInBackground: false,
    // Configure based on network conditions
    ...(!network.isOffline && network.effectiveType === 'slow-2g' && {
      refetchInterval: STALE_TIMES.STANDARD // Poll less frequently on slow connections
    }),
    // Allow overriding any options
    ...options
  });
}

// Hook for fetching a specific agent with smart polling
export function useAgent(agentId: UUID | undefined | null, options = {}) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => apiClient.getAgent(agentId || ''),
    staleTime: STALE_TIMES.FREQUENT, // Use shorter stale time for real-time data
    enabled: Boolean(agentId),
    // Use more frequent polling for real-time updates
    refetchInterval: !network.isOffline && Boolean(agentId) 
      ? STALE_TIMES.FREQUENT 
      : false,
    // Disable polling when the tab is not active
    refetchIntervalInBackground: false,
    // Configure based on network conditions
    ...(!network.isOffline && network.effectiveType === 'slow-2g' && {
      refetchInterval: STALE_TIMES.STANDARD // Poll less frequently on slow connections
    }),
    // Allow overriding any options
    ...options
  });
}

// Hook for fetching characters with smart polling (less frequent)
export function useCharacters(options = {}) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['characters'],
    queryFn: () => apiClient.getCharacters(),
    staleTime: STALE_TIMES.STANDARD,
    // Characters change less frequently, so poll less often
    refetchInterval: !network.isOffline 
      ? STALE_TIMES.RARE 
      : false,
    refetchIntervalInBackground: false,
    ...options
  });
}

// Hook for fetching a specific character with smart polling
export function useCharacter(characterName: string | undefined | null, isUrlEncoded = false, options = {}) {
  const network = useNetworkStatus();
  
  return useQuery({
    queryKey: ['character', characterName],
    queryFn: () => apiClient.getCharacter(characterName || '', isUrlEncoded),
    staleTime: STALE_TIMES.STANDARD,
    enabled: Boolean(characterName),
    // Characters change less frequently, so poll less often
    refetchInterval: !network.isOffline 
      ? STALE_TIMES.RARE 
      : false,
    refetchIntervalInBackground: false,
    ...options
  });
}

// Hook for starting an agent with optimistic updates
export function useStartAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (characterName: string) => apiClient.startAgentByName(characterName),
    onSuccess: (data) => {
      // Immediately invalidate the queries for fresh data
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['agent', data.id] });
      }
      
      toast({
        title: 'Agent Started',
        description: `${data?.name || 'Agent'} is now running`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start agent',
        variant: 'destructive',
      });
    }
  });
}

// Hook for stopping an agent with optimistic updates
export function useStopAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (agentId: string) => apiClient.stopAgent(agentId),
    onMutate: async (agentId) => {
      // Optimistically update the UI
      // Get the agent data from the cache
      const agent = queryClient.getQueryData<{ id: string; character: Character }>(['agent', agentId]);
      
      if (agent) {
        toast({
          title: 'Stopping Agent',
          description: `Stopping ${agent.character.name}...`,
        });
      }
    },
    onSuccess: (_, agentId) => {
      // Immediately invalidate the queries for fresh data
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      
      toast({
        title: 'Agent Stopped',
        description: 'The agent has been successfully stopped',
      });
    },
    onError: (error, agentId) => {
      // Force invalidate on error
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to stop agent',
        variant: 'destructive',
      });
    }
  });
}

// Hook for creating a character with optimistic updates
export function useCreateCharacter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (character: Character) => apiClient.createCharacter(character),
    onSuccess: (data) => {
      // Optimistically update characters list
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      
      toast({
        title: 'Character Created',
        description: `Successfully created character: ${data?.name || 'Unknown'}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create character',
        variant: 'destructive',
      });
    }
  });
}

// Hook for updating a character with optimistic updates
export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ characterName, character, isUrlEncoded = false }: { 
      characterName: string;
      character: Character;
      isUrlEncoded?: boolean;
    }) => apiClient.updateCharacter(characterName, character, isUrlEncoded),
    onSuccess: (_, variables) => {
      // Optimistically update character data
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterName] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      
      toast({
        title: 'Character Updated',
        description: `Successfully updated character: ${variables.character.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update character',
        variant: 'destructive',
      });
    }
  });
}

// Define the structure of character data response
interface CharactersResponse {
  characters: Character[];
  [key: string]: unknown;
}

// Hook for deleting a character with optimistic updates
export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ characterName, isUrlEncoded = false }: { 
      characterName: string;
      isUrlEncoded?: boolean;
    }) => apiClient.removeCharacter(characterName, isUrlEncoded),
    onMutate: async (variables) => {
      // Optimistically remove from the characters list
      const previousCharacters = queryClient.getQueryData<CharactersResponse>(['characters']);
      
      queryClient.setQueryData<CharactersResponse>(['characters'], (old) => {
        if (!old || !old.characters) return old;
        
        return {
          ...old,
          characters: old.characters.filter(
            (c: Character) => c.name !== variables.characterName
          )
        };
      });
      
      return { previousCharacters };
    },
    onSuccess: (_, variables) => {
      // Remove from the cache
      queryClient.removeQueries({ queryKey: ['character', variables.characterName] });
      
      toast({
        title: 'Character Deleted',
        description: `Successfully deleted character: ${variables.characterName}`,
      });
    },
    onError: (error, _, context) => {
      // Restore the previous data
      if (context?.previousCharacters) {
        queryClient.setQueryData(['characters'], context.previousCharacters);
      }
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete character',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    }
  });
} 