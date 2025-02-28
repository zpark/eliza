import PageTitle from "@/components/page-title";
import { ActionCard } from "@/components/ui/action-card";
import { useAgents } from "@/hooks/use-query-hooks";
import { Cog } from "lucide-react";

export default function Home() {

    const { data: agentsData, isLoading, isError, error } = useAgents();

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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {agents?.sort((a, b) => Number(b?.enabled) - Number(a?.enabled)).map((agent) => (
                    <ActionCard
                        key={agent.id}
                        name={agent.character.name}
                        primaryText={agent.enabled ? "Chat" : "Start"}
                        primaryVariant={agent.enabled ? "default" : "secondary"}
                        primaryLink={`/chat/${agent.id}`}
                        secondaryIcon={<Cog className="h-4 w-4" />}
                        secondaryTitle="Agent settings"
                        secondaryLink={`/settings/${agent.id}`}
                    />
                ))}
            </div>
        </div>
    );
}
