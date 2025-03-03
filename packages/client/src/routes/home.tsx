import PageTitle from "@/components/page-title";
import { useAgents } from "@/hooks/use-query-hooks";
import { Cog, Loader2, Play, Plus, Square } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "@/components/profile-card";
import { formatAgentName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { Agent } from "@elizaos/core";
import { useAgentManagement } from "@/hooks/use-agent-management";

export default function Home() {
    const { data: { data: agentsData } = {}, isLoading, isError, error } = useAgents();
    const navigate = useNavigate();
    
    // Use the agent management hook
    const { 
        startAgent, 
        stopAgent, 
        isAgentStarting, 
        isAgentStopping 
    } = useAgentManagement();

    // Extract agents properly from the response
    const agents = agentsData?.agents || [];

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
                    {agents?.sort((a: Agent, b: Agent) => Number(b?.enabled) - Number(a?.enabled)).map((agent: Agent) => {
                        const isActive = agent.status == 'active';
                        const isStarting = isAgentStarting(agent.id);
                        const isStopping = isAgentStopping(agent.id);
                        const isProcessing = isStarting || isStopping;
                        
                        let buttonLabel = "Start";
                        let buttonIcon = <Play />;
                        
                        if (isStarting) {
                            buttonLabel = "Starting...";
                            buttonIcon = <Loader2 className="animate-spin" />;
                        } else if (isStopping) {
                            buttonLabel = "Stopping...";
                            buttonIcon = <Loader2 className="animate-spin" />;
                        } else if (isActive) {
                            buttonLabel = "Stop";
                            buttonIcon = <Square size={16} />;
                        }
                        
                        return <ProfileCard
                            key={agent.id}
                            title={agent.name}
                            content={formatAgentName(agent.name)}
                            buttons={[
                                {
                                    label: buttonLabel,
                                    icon: buttonIcon,
                                    action: () => {
                                        if (isProcessing) return; // Prevent action while processing
                                        
                                        if (!isActive) {
                                            startAgent(agent);
                                        } else {
                                            stopAgent(agent);
                                        }
                                    },
                                    className: `w-full grow ${isActive ? "text-red-500" : ""} ${isProcessing ? "opacity-80 cursor-not-allowed" : ""}`,
                                    variant: !isActive ? "default" : "secondary",
                                    disabled: isProcessing,
                                },
                                {
                                    icon: <Cog />,
                                    className: "p-2",
                                    action: () => navigate(`/settings/${agent.id}`),
                                    variant: "outline",
                                    size: "icon"
                                }
                            ]}
                        />;
                    })}
                    
                    {/* Create new agent card */}
                    <Card className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => navigate("/create")}>
                        <div className="flex flex-col items-center justify-center gap-2 p-8">
                            <Plus size={40} className="text-muted-foreground" />
                            <span className="text-muted-foreground">Create New Agent</span>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
