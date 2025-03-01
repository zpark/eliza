import AgentCreator from "@/components/agent-creator";

export default function AgentCreatorRoute() {
    // const { agentId } = useParams<{ agentId: UUID }>();

    // const query = useQuery({
    //     queryKey: ["agent", agentId],
    //     queryFn: () => apiClient.getAgent(agentId ?? ""),
    //     // Use polling for real-time updates
    //     staleTime: STALE_TIMES.FREQUENT,
    //     refetchInterval: 5000, // Poll every 5 seconds
    //     enabled: Boolean(agentId),
    // });

    // if (!agentId) return <div>No data.</div>;

    // const character = query?.data?.character;

    // if (!character) return null;

    return <AgentCreator/>;
}
