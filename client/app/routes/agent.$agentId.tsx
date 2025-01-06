import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "~/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import Chat from "~/components/chat";
import Overview from "~/components/overview";
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
            <Tabs defaultValue="chat">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                </TabsList>
                <TabsContent value="chat">
                    <Chat/>
                </TabsContent>
                <TabsContent value="overview">
<Overview character={character}/>
                </TabsContent>
            </Tabs>
        </div>
    );
}
