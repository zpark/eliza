import { useParams } from "react-router";
import Chat from "@/components/group-chat2";
import type { UUID } from "@elizaos/core";

export default function AgentRoute() {
    const { roomId } = useParams<{ roomId: UUID }>();

    if (!roomId) return <div>No data.</div>;

    // Go directly to the chat in the room
    return <Chat roomId={roomId} />;
}
