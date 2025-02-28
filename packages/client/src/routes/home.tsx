import PageTitle from "@/components/page-title";
import { ActionCard } from "@/components/ui/action-card";
import { useAgents, useStartAgent } from "@/hooks/use-query-hooks";
import { Cog } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define agent type to fix linter error
interface Agent {
    id: string;
    character: {
        name: string;
    };
    enabled: boolean;
}

export default function Home() {
    const { data: agentsData, isLoading, isError, error } = useAgents();
    const startAgentMutation = useStartAgent();
    const navigate = useNavigate();

    // Extract agents properly from the response
    const agents = agentsData?.agents || [];

    // Handle agent start action
    const handleStartAgent = async (agent: Agent) => {
        try {
            await startAgentMutation.mutateAsync(agent.character.name);
            // Navigate to chat after successful start
            navigate(`/chat/${agent.id}`);
        } catch (error) {
            console.error("Failed to start agent:", error);
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <div className="flex items-center justify-between">
                <PageTitle title="Agents" />
                
            </div>
            
            {isLoading && (
                <div className="text-center py-8">Loading agents...</div>
            )}
            
            {isError && (
                <div className="text-center py-8 text-destructive">
                    Error loading agents: {error instanceof Error ? error.message : "Unknown error"}
                </div>
            )}
            
            {agents.length === 0 && !isLoading && (
                <div className="text-center py-8 flex flex-col items-center gap-4">
                    <p className="text-muted-foreground">
                        No agents currently running. Start a character to begin.
                    </p>
                    
                </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {agents?.sort((a, b) => Number(b?.enabled) - Number(a?.enabled)).map((agent) => (
                    <ActionCard
                        key={agent.id}
                        name={agent.character.name}
                        primaryText={agent.enabled ? "Chat" : "Start"}
                        primaryVariant={agent.enabled ? "default" : "secondary"}
                        primaryLink={agent.enabled ? `/chat/${agent.id}` : undefined}
                        primaryAction={!agent.enabled ? () => handleStartAgent(agent) : undefined}
                        secondaryIcon={<Cog className="h-4 w-4" />}
                        secondaryTitle="Agent settings"
                        secondaryLink={`/settings/${agent.id}`}
                    />
                ))}
            </div>
        </div>
    );
}
