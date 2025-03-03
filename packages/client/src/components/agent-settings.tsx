import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import type { Agent, UUID } from "@elizaos/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import CharacterForm from "@/components/character-form";
import { useAgent } from "@/hooks/use-query-hooks";
import PluginsPanel from "./plugins-panel";
import SecretPanel from "./secret-panel";

// Define interface for agent data response that includes enabled property
interface AgentResponse {
  id: UUID;
  character: Agent;
  enabled: boolean;
}

export default function AgentSettings({ agent, agentId }: { agent: Agent, agentId: UUID }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agentData = useAgent(agentId)?.data?.data;

  // The API actually returns an enabled property even though the type doesn't include it
  const isAgentEnabled = Boolean((agentData as unknown as AgentResponse)?.enabled);
  const [characterValue, setCharacterValue] = useState<Agent>(agent);

  const handleSubmit = async (updatedAgent: Agent) => {
    try {
      // Call the API to update the agent's character
      if (!agentId) {
        throw new Error("Agent ID is missing");
      }

      // Make sure plugins are preserved
      const mergedAgent = {
        ...updatedAgent,
        plugins: characterValue.plugins // Preserve the plugins from our local state
      };

      // Send the character update request to the agent endpoint
      await apiClient.updateAgent(agentId, mergedAgent);
      
      // Invalidate both the agent query and the agents list
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Agent updated and restarted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update agent",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleStopAgent = async () => {
    try {
      if (!agentId) {
        throw new Error("Agent ID is missing");
      }
      
      await apiClient.stopAgent(agentId);
      
      // Invalidate queries before showing toast and navigating
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Agent stopped successfully",
      });
      
      // Navigate to home page after successfully stopping the agent
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stop agent",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleStartAgent = async () => {
    try {
      if (!agentId) {
        throw new Error("Agent ID is missing");
      }
      
      await apiClient.startAgentByName(agent.name);
      
      // Invalidate queries for fresh data
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Agent started successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start agent",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <CharacterForm
      characterValue={characterValue} 
      setCharacterValue={setCharacterValue} 
      title="Character Settings" 
      description="Configure your AI character's behavior and capabilities"
      onSubmit={handleSubmit}
      onReset={() => setCharacterValue(agent)}
      submitButtonText="Save Changes"
      deleteButtonText={isAgentEnabled ? "Stop Agent" : "Start Agent"}
      deleteButtonVariant={isAgentEnabled ? "destructive" : "default"}
      onDelete={isAgentEnabled ? handleStopAgent : handleStartAgent}
      isAgent={true}
      customComponents={[
        {
          name: "Plugins",
          component: <PluginsPanel 
            characterValue={characterValue} 
            setCharacterValue={setCharacterValue} 
          />
        },
        {
          name: "Secret",
          component: <SecretPanel 
            characterValue={characterValue} 
            setCharacterValue={setCharacterValue} 
          />
        }
      ]}
    />
  );
}
