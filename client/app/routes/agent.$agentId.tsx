import { useParams } from "@remix-run/react";

export default function AgentRoute() {
    const { agentId } = useParams();
    return <div>Agent Page for ID: {agentId}</div>;
}
