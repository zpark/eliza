import { Button } from "@/components/ui/button";
import {
    ChatBubble,
    ChatBubbleMessage,
    ChatBubbleTimestamp,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useAgent, useAgents, useMessages, useRooms } from "@/hooks/use-query-hooks";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { cn, moment, stringToUuid } from "@/lib/utils";
import { WorldManager } from "@/lib/world-manager";
import type { IAttachment } from "@/types";
import type { Content, UUID } from "@elizaos/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AIWriter from "react-aiwriter";
import { AudioRecorder } from "./audio-recorder";
import CopyButton from "./copy-button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import ChatTtsButton from "./ui/chat/chat-tts-button";
import { useAutoScroll } from "./ui/chat/hooks/useAutoScroll";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { AppAgentsbar } from "./app-agentsbar";


const USER_NAME = "user";

type ExtraContentFields = {
    user: string;
    createdAt: number;
    isLoading?: boolean;
};

type ContentWithUser = Content & ExtraContentFields;

type NewMessagesResponse = {
    data: {
        message: ContentWithUser;
        agentId: UUID;
    };
};

function MessageContent({
    message,
    agentIds,
}: {
    message: ContentWithUser;
    agentIds: UUID[];
}) {
    return (
        <div className="flex flex-col">
            <ChatBubbleMessage
                isLoading={message.isLoading}
                {...(!agentIds.includes(message.userId) ? { variant: "sent" } : {})}
            >
                {!agentIds.includes(message.userId) ? message.text : <AIWriter>{message.text}</AIWriter>}
                {/* Attachments */}
                <div>
                    {message.attachments?.map((attachment: IAttachment) => (
                        <div
                            className="flex flex-col gap-1 mt-2"
                            key={`${attachment.url}-${attachment.title}`}
                        >
                            <img
                                alt="attachment"
                                src={attachment.url}
                                width="100%"
                                height="100%"
                                className="w-64 rounded-md"
                            />
                            <div className="flex items-center justify-between gap-4">
                                <span />
                                <span />
                            </div>
                        </div>
                    ))}
                </div>
            </ChatBubbleMessage>
            <div className="flex items-center gap-4 justify-between w-full mt-1">
                {message.text && !message.isLoading ? (
                    <div className="flex items-center gap-1">
                        <CopyButton text={message.text} />
                        <ChatTtsButton agentId={message.userId} text={message.text} />
                    </div>
                ) : null}
                <div
                    className={cn([
                        message.isLoading ? "mt-2" : "",
                        "flex items-center justify-between gap-4 select-none",
                    ])}
                >
                    {message.source ? (
                        <Badge variant="outline">{message.source}</Badge>
                    ) : null}
                    {message.action ? (
                        <Badge variant="outline">{message.action}</Badge>
                    ) : null}
                    {message.createdAt ? (
                        <ChatBubbleTimestamp timestamp={moment(message.createdAt).format("LT")} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
type MessageData = {
    userId: UUID;
    userName: string;
    agentId: UUID;
    text: string;
};

enum Priority {
    High = 1,
    Low = 2
}

type Task = {
    priority: Priority;
    message: MessageData & { text: string };
}

class MessageProcessor {
    private QUEUE_SIZE = 2;
    public agentId: UUID;
    private taskQueue: Task[] = [];
    private isProcessing = false;
    private recieveMessageFn: (messageData: MessageData) => Promise<void>;


    constructor(agentId: UUID, recieveMessageFn: (messageData: MessageData) => Promise<void>) {
        this.agentId = agentId;
        this.recieveMessageFn = recieveMessageFn;
    }

    private async processTask() {
        if (this.isProcessing || !this.taskQueue.length) return;

        this.isProcessing = true;

        while (this.taskQueue.length) {
            this.taskQueue.sort((a: Task, b: Task) => {
                return a.priority - b.priority;
            });
    
            if (this.taskQueue.length > this.QUEUE_SIZE) {
                this.taskQueue = this.taskQueue.slice(0, this.QUEUE_SIZE);
            }
    
            const task = this.taskQueue.shift();
            if (!task) break;

            try {
                await this.recieveMessageFn(task.message);
            } catch (error) {
                console.error("Task processing failed:", error);
            }
        }

        this.isProcessing = false;
    }

    addMessage(task: Task) {
        this.taskQueue.push(task);

        if (!this.isProcessing) {
            this.processTask();
        }
    }
}

export default function Page({ roomId }: { roomId: UUID }) {
    const { toast } = useToast();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const queryClient = useQueryClient();
    const worldId = WorldManager.getWorldId();
    
    const { data: { data: agentsData } = {}, isLoading } = useAgents();
    const { data: { data: roomsData } = {} } = useRooms();
    
    const roomData = roomsData?.find((data) => data.id === roomId);
    const chatOwnerId = roomData?.agentId;

    const roomAgentsIds = roomData?.participants.map((participant: any) => {
        return participant.id;
    })
    const roomAgents = agentsData?.agents?.filter((agent) => {
        return roomData?.participants.some((participant: any) => {
            return participant.id === agent.id;
        }) 
    })
    const onlineAgents = agentsData?.agents?.filter((agent) => {
        return roomData?.participants.some((participant: any) => {
            return participant.id === agent.id && agent.status === "active"
        }) 
    });

    const offlineAgents = agentsData?.agents?.filter((agent) => {
        return roomData?.participants.some((participant: any) => {
            return participant.id === agent.id && agent.status === "inactive"
        }) 
    });

    const messageProcessors = new Map<UUID, MessageProcessor>();

    useEffect(() => {
        if (onlineAgents) {
            onlineAgents.forEach((agent) => {
                if (!messageProcessors.has(agent.id)) {
                    messageProcessors.set(agent.id, new MessageProcessor(agent.id, async (messageData: MessageData) => {
                        await receiveMessageMutation.mutateAsync(messageData);
                    }));
                }
            });
        }
    }, [onlineAgents]);

    const getAgentName = (agentId: UUID) => {
        const agent = roomAgents?.find((agent) => {
            return agent.id === agentId;
        })

        return  agent.name;
    }

    const broadcastMessageToAgents = (messageData: MessageData, priority: Priority) => {
        console.log("start broadcast message:", messageData);
        onlineAgents?.forEach((agent) => {
            const processor = messageProcessors.get(agent.id);
            if (processor && messageData.userId !== agent.id) {
                console.log("broadcast to agentID: ", agent.id);
                processor.addMessage({
                    priority,
                    message: {...messageData, agentId: agent.id, text: messageData.text}
                });
            }
        });
    };

    const { data: olderMessages } = useMessages(chatOwnerId, roomId);

    const messages = olderMessages ?? [];

    const agentData = useAgent(chatOwnerId)?.data?.data;
    
    const getMessageVariant = (userId: string) =>
        roomAgentsIds.includes(userId) ? "received" : "sent";

    const { scrollRef, isAtBottom, scrollToBottom, disableAutoScroll } = useAutoScroll({
        smooth: true,
    });
   
    useEffect(() => {
        scrollToBottom();
    }, [queryClient.getQueryData(["messages", chatOwnerId, roomId, worldId])]);

    useEffect(() => {
        scrollToBottom();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (e.nativeEvent.isComposing) return;
            handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input) return;

        const userId = stringToUuid(`${roomId} - ${USER_NAME}`);
        const messageData: MessageData = { 
            userId, 
            text: input, 
            userName: USER_NAME, 
            agentId: chatOwnerId 
        };
        sendMessageMutation.mutateAsync(messageData);

        setSelectedFile(null);
        setInput("");
        formRef.current?.reset();
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const sendMessageMutation = useMutation({
        mutationKey: ["send_message"],
        mutationFn: ({
            userId,
            userName,
            agentId,
            text,
        }: {
            userId: UUID;
            userName: string;
            agentId: UUID;
            text: string;
        }) => apiClient.sendRoomMessage(userId, userName, text, roomId, agentId),
        onSuccess: (newMessages: NewMessagesResponse) => {
            if (newMessages) {
                queryClient.setQueryData(
                    ["messages", chatOwnerId, roomId, worldId],
                    (old: ContentWithUser[] = []) => {
                        return [
                            ...old.filter((msg) => !msg.isLoading),
                            {...newMessages.data.message, createdAt: Date.now()},
                        ]
                    }
                );
                const message = newMessages.data.message;
                broadcastMessageToAgents(
                    message, message.user === USER_NAME ? 
                        Priority.High : 
                        Priority.Low
                );
            } else {
                queryClient.setQueryData(
                    ["messages", chatOwnerId, roomId, worldId],
                    (old: ContentWithUser[] = []) => {
                        return [
                            ...old.filter((msg) => !msg.isLoading)
                        ]
                    }
                );
            }
        },
        onError: (e) => {
            toast({
                variant: "destructive",
                title: "Unable to send message",
                description: e.message,
            });
        },
    });

    const receiveMessageMutation = useMutation({
        mutationKey: ["receive_message"],
        mutationFn: ({
            userId,
            userName,
            agentId,
            text,
        }: {
            userId: UUID;
            userName: string;
            agentId: UUID;
            text: string;
        }) => {
            return apiClient.receiveRoomMessage(userId, userName, text, roomId, agentId)
        },
        onSuccess: async (newMessages: NewMessagesResponse) => {
            if (newMessages) {
                const messageData = {
                    ...newMessages.data.message, 
                    userId: newMessages.data.agentId,
                    userName: newMessages.data.message.user
                };
                await sendMessageMutation.mutateAsync(messageData);
            }
        },
        onError: (e) => {
            toast({
                variant: "destructive",
                title: "Unable to send message",
                description: e.message,
            });
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file?.type.startsWith("image/")) {
            setSelectedFile(file);
        }
    };

    return (
        <div className="flex">
            <div className="flex flex-col w-full h-[calc(100dvh)] p-4">
                {/* Agent Header */}
                <div className="flex items-center justify-between mb-4 p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-3">
                        <Avatar className="size-10 border rounded-full">
                            <AvatarImage src="/elizaos-icon.png" />
                        </Avatar>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold text-lg">
                                    {agentData?.name || "Agent"}
                                </h2>
                                {agentData?.enabled ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="size-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20 animate-pulse" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>Agent is active</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="size-2.5 rounded-full bg-gray-300 ring-2 ring-gray-300/20" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>Agent is inactive</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                            {agentData?.bio && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                    {Array.isArray(agentData.bio) 
                                        ? agentData.bio[0] 
                                        : agentData.bio}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    <ChatMessageList 
                        scrollRef={scrollRef}
                        isAtBottom={isAtBottom}
                        scrollToBottom={scrollToBottom}
                        disableAutoScroll={disableAutoScroll}
                    >
                        {messages.map((message: ContentWithUser) => {
                            return (
                                <div
                                    key={message.user + message.createdAt}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem",
                                        padding: "1rem",
                                    }}
                                >
                                    <ChatBubble
                                        variant={getMessageVariant(message.userId)}
                                        className="flex flex-row items-center gap-2"
                                    >
                                        {roomAgentsIds.includes(message.userId) ? (
                                            <>
                                                {getAgentName(message.userId)}
                                                <MessageContent message={message} agentIds={roomAgentsIds} />
                                            </>
                                        ) : (
                                            <>
                                                <MessageContent message={message} agentIds={roomAgentsIds} />
                                                <Avatar className="size-8 p-1 border rounded-full select-none">
                                                    <AvatarImage src="/user-icon.png" />
                                                    <AvatarFallback>
                                                        U
                                                    </AvatarFallback>
                                                </Avatar>
                                            </>
                                        )}
                                    </ChatBubble>
                                </div>
                            );
                        })}
                    </ChatMessageList>
                </div>
                <div className="px-4 pb-4">
                    <form
                        ref={formRef}
                        onSubmit={handleSendMessage}
                        className="relative rounded-md border bg-card"
                    >
                        {selectedFile ? (
                            <div className="p-3 flex">
                                <div className="relative rounded-md border p-2">
                                    <Button
                                        onClick={() => setSelectedFile(null)}
                                        className="absolute -right-2 -top-2 size-[22px] ring-2 ring-background"
                                        variant="outline"
                                        size="icon"
                                    >
                                        <X />
                                    </Button>
                                    <img
                                        alt="Selected file"
                                        src={URL.createObjectURL(selectedFile)}
                                        height="100%"
                                        width="100%"
                                        className="aspect-square object-contain w-16"
                                    />
                                </div>
                            </div>
                        ) : null}
                        <ChatInput
                            ref={inputRef}
                            onKeyDown={handleKeyDown}
                            value={input}
                            onChange={({ target }) => setInput(target.value)}
                            placeholder="Type your message here..."
                            className="min-h-12 resize-none rounded-md bg-card border-0 p-3 shadow-none focus-visible:ring-0"
                        />
                        <div className="flex items-center p-3 pt-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.click();
                                                }
                                            }}
                                        >
                                            <Paperclip className="size-4" />
                                            <span className="sr-only">
                                                Attach file
                                            </span>
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    <p>Attach file</p>
                                </TooltipContent>
                            </Tooltip>
                            <AudioRecorder
                                agentId={chatOwnerId}
                                onChange={(newInput: string) => setInput(newInput)}
                            />
                            <Button
                                disabled={!input || sendMessageMutation?.isPending}
                                type="submit"
                                size="sm"
                                className="ml-auto gap-1.5 h-[30px]"
                            >
                                {sendMessageMutation?.isPending
                                    ? "..."
                                    : "Send Message"}
                                <Send className="size-3.5" />
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
            <AppAgentsbar onlineAgents={onlineAgents || []} offlineAgents={offlineAgents || []} isLoading={isLoading}/>
        </div>
        
    );
}
