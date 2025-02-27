import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import type { UUID } from "@elizaos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, PlusCircle, ChevronDown } from "lucide-react";
import { useMessages } from "@/hooks/use-query-hooks";
import { WorldManager } from "@/lib/world-manager";
import type { Content } from "@elizaos/core";

type Room = {
    id: UUID;
    name: string;
    createdAt?: number;
    lastMessage?: string;
    source?: string;
};

// Define the ContentWithUser type
type ContentWithUser = Content & {
    user: string;
    createdAt: number;
    isLoading?: boolean;
    id?: string;
};

export default function RoomList({ agentId }: { agentId: UUID }) {
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [newRoomName, setNewRoomName] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [expandedRoomId, setExpandedRoomId] = useState<UUID | null>(null);

    // Fetch rooms for this agent
    const { data: rooms = [], isLoading, error } = useQuery({
        queryKey: ["rooms", agentId],
        queryFn: () => apiClient.getRooms(agentId),
    });

    // Create a new room
    const createRoomMutation = useMutation({
        mutationFn: () => apiClient.createRoom(agentId, newRoomName || `Chat ${new Date().toLocaleString()}`),
        onSuccess: (newRoom) => {
            queryClient.invalidateQueries({ queryKey: ["rooms", agentId] });
            setIsCreateDialogOpen(false);
            setNewRoomName("");
            navigate(`/chat/${agentId}/${newRoom.id}`);
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Failed to create room",
                description: error instanceof Error ? error.message : "An unknown error occurred",
            });
        },
    });

    const handleCreateRoom = () => {
        createRoomMutation.mutate();
    };

    const navigateToRoom = (roomId: UUID) => {
        navigate(`/chat/${agentId}/${roomId}`);
    };

    // Function to toggle expanded state for a room
    const toggleRoomExpanded = (roomId: UUID, e: React.MouseEvent) => {
        e.stopPropagation();
        if (expandedRoomId === roomId) {
            setExpandedRoomId(null);
        } else {
            setExpandedRoomId(roomId);
            // Fetch messages for this room when expanded
            queryClient.prefetchQuery({
                queryKey: ['messages', agentId, roomId, WorldManager.getWorldId()],
                queryFn: () => apiClient.getMemories(agentId, roomId)
            });
        }
    };
    
    // Get messages for the expanded room
    const expandedRoomMessages = expandedRoomId 
        ? queryClient.getQueryData<ContentWithUser[]>([
            'messages', 
            agentId, 
            expandedRoomId, 
            WorldManager.getWorldId()
          ]) || []
        : [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center w-full h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8">
                <p className="text-destructive">Failed to load rooms</p>
                <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "Unknown error"}
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Conversations</h1>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <PlusCircle className="h-4 w-4" />
                            New Conversation
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create a new conversation</DialogTitle>
                            <DialogDescription>
                                Give your conversation a name or leave it blank for a default name.
                            </DialogDescription>
                        </DialogHeader>
                        <Input
                            placeholder="Conversation name (optional)"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                        />
                        <DialogFooter>
                            <Button 
                                onClick={handleCreateRoom}
                                disabled={createRoomMutation.isPending}
                            >
                                {createRoomMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create"
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {rooms.length === 0 ? (
                <div className="text-center p-8 border rounded-lg">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No conversations yet</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Start a new conversation to chat with this agent.
                    </p>
                    <Button 
                        className="mt-4" 
                        onClick={() => setIsCreateDialogOpen(true)}
                    >
                        Start Conversation
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {rooms.map((room: Room) => (
                        <div 
                            key={room.id}
                            className="border rounded-md overflow-hidden"
                        >
                            <Button
                                variant="ghost" 
                                className="w-full justify-between text-left h-auto p-3 hover:bg-accent/50"
                                onClick={() => navigateToRoom(room.id)}
                                aria-label={`Open conversation: ${room.name}`}
                            >
                                <div className="flex flex-col gap-1 w-full">
                                    <div className="font-medium">{room.name}</div>
                                    {room.createdAt && (
                                        <div className="text-xs text-muted-foreground">
                                            Created {new Date(room.createdAt).toLocaleString()}
                                        </div>
                                    )}
                                    {room.lastMessage && (
                                        <p className="text-sm truncate text-muted-foreground max-w-md border-l-2 border-accent pl-2 mt-1">
                                            {room.lastMessage}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                    {room.source && (
                                        <div className="text-xs text-muted-foreground">{room.source}</div>
                                    )}
                                    <Button 
                                        variant="secondary" 
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateToRoom(room.id);
                                        }}
                                    >
                                        Open
                                    </Button>
                                </div>
                            </Button>

                            {room.lastMessage ? (
                                <div className="px-3 pb-3">
                                    <Button 
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1 self-start p-0 h-auto text-xs gap-1"
                                        onClick={(e) => toggleRoomExpanded(room.id, e)}
                                    >
                                        <span className="flex items-center gap-1 underline">
                                            {expandedRoomId === room.id ? "Hide messages" : "Show more messages"}
                                            <ChevronDown className={`h-3 w-3 transition-transform ${expandedRoomId === room.id ? 'rotate-180' : ''}`} />
                                        </span>
                                    </Button>
                                    
                                    {expandedRoomId === room.id && expandedRoomMessages.length > 0 && (
                                        <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-background">
                                            {expandedRoomMessages.slice(0, 3).map((msg: ContentWithUser) => (
                                                <div 
                                                    key={msg.id || `msg-${msg.createdAt}-${msg.user}`} 
                                                    className="mb-2 last:mb-0"
                                                >
                                                    <div className="text-xs font-medium mb-1">
                                                        {msg.user === 'user' ? 'You' : 'Agent'}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {msg.text}
                                                    </p>
                                                </div>
                                            ))}
                                            {expandedRoomMessages.length > 3 && (
                                                <div className="text-xs text-center mt-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => navigateToRoom(room.id)}
                                                    >
                                                        View all messages
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="px-3 pb-3">
                                    <p className="text-sm text-muted-foreground">No messages yet</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 