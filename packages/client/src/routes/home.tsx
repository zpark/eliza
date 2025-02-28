import PageTitle from "@/components/page-title";
import { ActionCard } from "@/components/ui/action-card";
import { useAgents } from "@/hooks/use-query-hooks";
import type { UUID } from "@elizaos/core";
import { Cog } from "lucide-react";

export default function Home() {

    const { data: agentsData } = useAgents();

    const agents = agentsData?.agents || [];

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <div className="flex items-center justify-between">
                <PageTitle title="Agents" />
                
            </div>
            
            {agentsData?.isLoading && (
                <div className="text-center py-8">Loading agents...</div>
            )}
            
            {agentsData?.isError && (
                <div className="text-center py-8 text-destructive">
                    Error loading agents: {agentsData?.error instanceof Error ? agentsData?.error.message : "Unknown error"}
                </div>
            )}
            
            {agents.length === 0 && !agentsData?.isLoading && (
                <div className="text-center py-8 flex flex-col items-center gap-4">
                    <p className="text-muted-foreground">
                        No agents currently running. Start a character to begin.
                    </p>
                    
                </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {agents?.map((agent: { id: UUID; name: string }) => (
                    <ActionCard
                        key={agent.id}
                        name={agent?.name}
                        primaryText="Chat"
                        primaryVariant="default"
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
