import PageTitle from "@/components/page-title";
import { useAgents } from "@/hooks/use-query-hooks";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "@/components/profile-card";
import { formatAgentName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { Agent } from "@elizaos/core";
import ProfileOverlay from "@/components/profile-overlay";
import { useState } from "react";
import { AppAgentsbar } from "@/components/app-agentsbar";

export default function Home() {
    const { data: { data: agentsData } = {}, isLoading, isError, error } = useAgents();
    const navigate = useNavigate();

    const [isOverlayOpen, setOverlayOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    const openOverlay = (agent: Agent) => {
        setSelectedAgent(agent);
        setOverlayOpen(true);
    };

    const closeOverlay = () => {
        setSelectedAgent(null);
        setOverlayOpen(false);
    };

    const agents = agentsData?.agents || [];
    const onlineAgents = agentsData?.agents?.filter((agent) => agent.status === "active");
    const offlineAgents = agentsData?.agents?.filter((agent) => agent.status === "inactive");

    return (
        <>
            <div className="flex">
                <div className="flex flex-col gap-4 h-full p-6 w-full">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {agents?.sort((a: Agent, b: Agent) => Number(b?.enabled) - Number(a?.enabled)).map((agent: Agent) => {
                                return (
                                    <ProfileCard
                                        key={agent.id}
                                        title={agent.name}
                                        content={formatAgentName(agent.name)}
                                        buttons={[
                                            {
                                                label: "View",
                                                action: () => {
                                                    openOverlay(agent)
                                                },
                                                className: `w-[80%]`,
                                                variant: "default",
                                            }
                                        ]} 
                                    />
                                )
                            })}
                            {/* Create new agent card */}
                            <Card className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => navigate("/create")}>
                                <div className="flex flex-col items-center justify-center gap-2 p-8">
                                    <Plus size={40} className="text-muted-foreground" />
                                    <span className="text-muted-foreground whitespace-nowrap">Create New Agent</span>
                                </div>
                            </Card>
                        </div>
                        
                    )}
                </div>
                <AppAgentsbar onlineAgents={onlineAgents || []} offlineAgents={offlineAgents || []}/>
            </div>

           
            <ProfileOverlay 
                isOpen={isOverlayOpen} 
                onClose={closeOverlay} 
                agent={agents.find((a) => a.id === selectedAgent?.id) || selectedAgent}
                agents={agents}
            />
            
        </>
        
    );
}
