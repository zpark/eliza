import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import CharacterForm from "@/components/character-form";
import type { Character, UUID } from "@elizaos/core";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Define Agent type interface based on the API response
interface Agent {
  id: UUID;
  name: string;
  character?: Character;
}

export default function EditCharacter() {
  const { characterName } = useParams<{ characterName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inUseError, setInUseError] = useState<string | null>(null);
  
  // No need to convert separately since we'll use URL-aware methods
  const urlCharacterName = characterName || "";

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["character", urlCharacterName],
    queryFn: () => apiClient.getCharacter(urlCharacterName, true),
    enabled: !!urlCharacterName,
  });

  // Check for active agents using this character
  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    enabled: !!urlCharacterName,
  });

  // Ensure agents is treated as an array, with proper type checking
  const isCharacterInUse = Array.isArray(agents) ? agents.some((agent: Agent) => 
    agent.character?.id === data?.id || agent.character?.name === urlCharacterName
  ) : false;

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Edit Character</h1>
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Edit Character</h1>
            <p className="text-muted-foreground mt-1">Failed to load character</p>
          </div>
        </div>
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          <h4 className="font-medium mb-2">Error</h4>
          <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const ensureRequiredFields = (character: Character): Character => {
    // Clone character to avoid mutating original
    const completedCharacter = { ...character };
    
    // Ensure all required fields are present
    if (!completedCharacter.name) completedCharacter.name = data.name;
    if (!completedCharacter.bio) completedCharacter.bio = data.bio;
    if (!completedCharacter.messageExamples) completedCharacter.messageExamples = data.messageExamples || [];
    if (!completedCharacter.postExamples) completedCharacter.postExamples = data.postExamples || [];
    if (!completedCharacter.topics) completedCharacter.topics = data.topics || [];
    if (!completedCharacter.adjectives) completedCharacter.adjectives = data.adjectives || [];
    if (!completedCharacter.plugins) completedCharacter.plugins = data.plugins || [];
    
    // Ensure style field exists
    if (!completedCharacter.style) {
      completedCharacter.style = data.style || { all: [], chat: [], post: [] };
    } else {
      // Ensure all style subfields exist
      completedCharacter.style.all = completedCharacter.style.all || data.style?.all || [];
      completedCharacter.style.chat = completedCharacter.style.chat || data.style?.chat || [];
      completedCharacter.style.post = completedCharacter.style.post || data.style?.post || [];
    }
    
    return completedCharacter;
  };

  const handleSubmit = async (updatedChar: Character) => {
    setIsSubmitting(true);
    
    try {
      // Ensure all required fields are present
      const completeCharacter = ensureRequiredFields(updatedChar);
      
      await apiClient.updateCharacter(urlCharacterName, completeCharacter, true);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["character", urlCharacterName] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      
      toast({
        title: "Success",
        description: "Character updated successfully",
      });
      
      navigate('/characters');
    } catch (error) {
      console.error("Failed to update character", error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      // First, check if there are any agents using this character
      const agentsResponse = await apiClient.getAgents();
      const associatedAgents = agentsResponse.agents.filter(
        (agent: Agent) => agent.name === urlCharacterName
      );
      
      // If there are agents using this character, stop and remove them first
      if (associatedAgents.length > 0) {
        // Alert the user about stopping agents
        toast({
          title: "Stopping Agents",
          description: `Stopping ${associatedAgents.length} agent(s) using this character...`,
        });
        
        // Stop and remove all associated agents
        for (const agent of associatedAgents) {
          try {
            // First stop the agent
            await apiClient.stopAgent(agent.id);
            // Then remove the agent (add a small delay to ensure it's fully stopped)
            await new Promise(resolve => setTimeout(resolve, 500));
            await apiClient.removeAgent(agent.id);
          } catch (agentError) {
            console.error(`Error stopping agent ${agent.id}:`, agentError);
            // Continue with other agents even if one fails
          }
        }
      }
      
      // Now that all agents are removed, delete the character
      await apiClient.removeCharacter(urlCharacterName, true);
      
      // Invalidate the characters query
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Character deleted successfully",
      });
      
      navigate('/characters');
    } catch (error) {
      console.error("Failed to delete character", error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete character",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <CharacterForm
        character={data}
        title="Edit Character"
        description={`Edit details for ${data.name}`}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onCancel={() => navigate('/characters')}
        onReset={() => queryClient.invalidateQueries({ queryKey: ["character", urlCharacterName] })}
        deleteButtonText="Delete Character"
        submitButtonText="Save Changes"
      />
      
      {/* Error dialog for characters in use */}
      <Dialog open={!!inUseError} onOpenChange={() => setInUseError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Character In Use</DialogTitle>
            <DialogDescription>
              {inUseError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setInUseError(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 