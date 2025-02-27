import { useParams } from "react-router";
import Chat from "@/components/chat";
import RoomList from "@/components/room-list";
import type { UUID } from "@elizaos/core";

export default function AgentRoute() {
    const { agentId, roomId } = useParams<{ agentId: UUID, roomId?: UUID }>();

    if (!agentId) return <div>No data.</div>;

    // If no roomId is provided, show the room list
    if (!roomId) {
        return <RoomList agentId={agentId} />;
    }

    // If a roomId is provided, show the chat
    return <Chat agentId={agentId} roomId={roomId} />;
}
