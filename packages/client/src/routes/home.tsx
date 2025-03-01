import PageTitle from "@/components/page-title";
import { useAgents, useStartAgent } from "@/hooks/use-query-hooks";
import { Cog, Play, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "@/components/profile-card";
import { formatAgentName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

            {!isLoading && !isError &&(
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {agents?.sort((a, b) => Number(b?.enabled) - Number(a?.enabled)).map((agent) => (
                        <ProfileCard
                            key={agent.id}
                            title={agent.character.name}
                            content={formatAgentName(agent.character.name)}
                            buttons={[
                                {
                                    label: agent.enabled ? "Chat" : "Start",
                                    icon: agent.enabled ? undefined : <Play />,
                                    action: () => {
                                        if (!agent.enabled) {
                                            handleStartAgent(agent);
                                        } else {
                                            navigate(`/chat/${agent.id}`)
                                        }
                                    },
                                    className: "w-full grow",
                                    variant: agent.enabled ? "default" : "secondary",
                                },
                                {
                                    icon: <Cog />,
                                    className: "p-2",
                                    action: () => navigate(`/settings/${agent.id}`),
                                    variant: "outline",
                                    size: "icon"
                                }
                            ]}
                        />
                    ))}
                    <Card className="flex justify-center items-center" onClick={() => navigate('/agents/new')}>
                        <Button 
                            variant="ghost" 
                            className="h-24 w-24 rounded-full flex items-center justify-center"
                        >
                            <Plus style={{ width: 40, height: 40 }} />
                        </Button>
                    </Card>
                </div>
            )}
        </div>
    );
}
