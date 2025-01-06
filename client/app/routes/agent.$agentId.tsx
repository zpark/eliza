import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { apiClient } from "~/lib/api";

export default function AgentRoute() {
    const { agentId } = useParams();

    if (!agentId) return <div>No data.</div>;

    const query = useQuery({
        queryKey: ["agent", agentId],
        queryFn: () => apiClient.getAgent(agentId),
    });

    const character = query?.data?.character;

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                <p className="text-muted-foreground">
                    An overview of your selected AI Agent.
                </p>
            </div>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={character?.name} readOnly />
                </div>
                <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={character?.username} readOnly />
                </div>
                <div className="space-y-2">
                    <Label>System</Label>
                    <Input value={character?.system} readOnly />
                </div>
                <div className="space-y-2">
                    <Label>Model</Label>
                    <Input value={character?.modelProvider} readOnly />
                </div>
                <div className="space-y-2">
                    <Label>Voice Model</Label>
                    <Input value={character?.settings?.voice?.model} readOnly />
                </div>
            </div>
            <div className="break-words whitespace-preline">
                Agent Page for ID: {agentId}
                {character ? JSON.stringify(character, null, 4) : ""}
            </div>
        </div>
    );
}
