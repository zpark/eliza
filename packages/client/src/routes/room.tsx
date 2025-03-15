import Room from "@/components/room";
import type { UUID } from "@elizaos/core";
import { useParams } from "react-router";
import { useSearchParams } from "react-router-dom";

export default function AgentRoute() {
	const [searchParams] = useSearchParams();
  	const roomName = searchParams.get("roomname");
	const { roomId } = useParams<{ roomId: UUID }>();

	if (!roomId) return <div>No data.</div>;

	// Go directly to the chat with the agent, skipping the room selection
	return <Room agentId={roomId} roomName={roomName}/>;
}
