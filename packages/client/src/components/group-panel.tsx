import type { Agent, UUID } from "@elizaos/core";
import { Card, CardContent } from "./ui/card";
import { formatAgentName } from "@/lib/utils";
import { Button } from "./ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch-button";
import { apiClient } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

interface GroupPanel {
    agent: Agent;
    agents: Agent[];
    onClose: () => void;
}

export default function GroupPanel({ onClose, agent, agents }: GroupPanel) {
    const [chatName, setChatName] = useState(`New Group Chat - ${agent.name}`);
    const [selectedAgents, setSelectedAgents] = useState<{ [key: string]: boolean }>({});
    const [creating, setCreating] = useState(false);

    const queryClient = useQueryClient();
    const navigate = useNavigate();
    
    const toggleAgentSelection = (agentId: string) => {
        setSelectedAgents((prev) => ({
            ...prev,
            [agentId]: !prev[agentId]
        }));
    };

    return (
        <Card className="flex flex-col items-center justify-between h-[70vh] w-[70vh]" 
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex gap-3 items-center w-full px-2 py-4">
                <ChevronLeft className="cursor-pointer" onClick={() => onClose()}/>
                <h1 className="text-xl">Create Group Chat</h1>
            </div>
            
            <div className="w-full h-full relative">
                <div className="w-full h-[20%] px-6 flex flex-col items-center">
                    <div className="flex w-full h-full justify-between items-center px-6">
                        <div className="flex gap-2">
                            <div className="bg-muted rounded-full w-20 h-20 flex justify-center items-center relative">
                                {agent && <div className="text-4xl">{formatAgentName(agent.name)}</div>}
                            </div>
                            <div className="flex flex-col justify-center items-center ml-2 font-bold">
                                <div className="text-gray-500 font-light">Owner</div>
                                <div className="text-xl">{(agent.name)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <CardContent className="w-full h-[80%] flex flex-col items-center">
                    <div className="rounded-md h-full w-full mb-3">
                        <div className="flex h-full">
                            <div className="p-6 overflow-scroll flex flex-col gap-4 w-full">
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="font-light">Chat Name</div>
                                    <Input 
                                        value={chatName}
                                        onChange={(e) => setChatName(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <div className="font-light">Invite Agents</div>
                                    <div className="flex flex-col gap-4 overflow-scroll pt-3">
                                        {agents.filter((agentData) => agentData.id !== agent.id).map((agent) => {
                                            return <div className="bg-muted rounded-sm h-16">
                                                <div className="flex w-full h-full justify-between items-center">
                                                    <div className="flex gap-2 items-center h-full w-full p-4">
                                                        <div className="bg-card rounded-full w-12 h-12 flex justify-center items-center relative">
                                                            {agent && <div className="text-xl">{formatAgentName(agent.name)}</div>}
                                                        </div>
                                                        <div className="flex flex-col justify-center items-center ml-2">
                                                            <div className="text-lg">{(agent.name)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="mr-6">
                                                        <Switch
                                                            checked={selectedAgents[agent.id]}
                                                            onChange={() => toggleAgentSelection(agent.id)}
                                                        />
                                                    </div>
                                                    
                                                </div>
                                            </div>
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div> 
                        
                    </div>
                    <div className="flex items-center justify-center w-full">
                        <Button
                            variant={"default"}
                            className={`w-[90%]`}
                            onClick={async () => {
                                setCreating(true);
                                const roomId = uuidv4() as UUID;
                                try {
                                    await apiClient.createRoom(
                                        agent.id,
                                        chatName,
                                        roomId
                                    );
                                    const selectedAgentIds = Object.keys(selectedAgents).filter(agentId => selectedAgents[agentId]);
                                    
                                    if (selectedAgentIds.length > 0) {
                                        await apiClient.createParticipants(roomId, selectedAgentIds);
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["rooms"] });
                                } catch(error) {
                                    console.error("Failed to create room", error);
                                } finally {
                                    setCreating(false);
                                    navigate(`/chat/${roomId}`)
                                }
                            }}
                            size={"default"}
                            disabled= {!chatName.length}
                        >
                            {creating ? <Loader2 className="animate-spin" /> : "Create Chat"}
                        </Button>
                    </div>
                </CardContent>
            </div>
        </Card>
       
    );
}
