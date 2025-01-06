import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "~/lib/api";
import Chat from "~/components/chat";

export default function AgentRoute() {
    const { agentId } = useParams();

    if (!agentId) return <div>No data.</div>;

    return <Chat agentId={agentId} />;
}
