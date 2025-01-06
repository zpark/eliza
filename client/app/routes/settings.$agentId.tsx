import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "~/lib/api";
import Overview from "~/components/overview";
export default function AgentRoute() {
    const { agentId } = useParams();

    if (!agentId) return <div>No data.</div>;

    const query = useQuery({
        queryKey: ["agent", agentId],
        queryFn: () => apiClient.getAgent(agentId),
    });

    const character = query?.data?.character;

    return <Overview character={character} />;
}
