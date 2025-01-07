import { Button } from "@/components/ui/button";
import {
    ChatBubble,
    ChatBubbleMessage,
    ChatBubbleTimestamp,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Mic, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Content, UUID } from "@elizaos/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { cn, moment } from "@/lib/utils";
import { Avatar, AvatarImage } from "./ui/avatar";
import CopyButton from "./copy-button";
import ChatTtsButton from "./ui/chat/chat-tts-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import AIWriter from "react-aiwriter";

interface ExtraContentFields {
    user: string;
    createdAt: number;
    isLoading?: boolean;
}

type ContentWithUser = Content & ExtraContentFields;

export default function Page({ agentId }: { agentId: UUID }) {
    const { toast } = useToast();
    const [input, setInput] = useState("");
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const queryClient = useQueryClient();

    const getMessageVariant = (role: string) =>
        role !== "user" ? "received" : "sent";

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
                messagesContainerRef.current.scrollHeight;
        }
    }, [queryClient.getQueryData(["messages", agentId])]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input) return;

        const newMessages = [
            {
                text: input,
                user: "user",
                createdAt: Date.now(),
            },
            {
                text: input,
                user: "system",
                isLoading: true,
                createdAt: Date.now(),
            },
        ];

        queryClient.setQueryData(
            ["messages", agentId],
            (old: ContentWithUser[] = []) => [...old, ...newMessages]
        );

        sendMessageMutation.mutate(input);

        setInput("");
        formRef.current?.reset();
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const sendMessageMutation = useMutation({
        mutationKey: ["send_message", agentId],
        mutationFn: (message: string) =>
            apiClient.sendMessage(agentId, message),
        onSuccess: (newMessages: ContentWithUser[]) => {
            queryClient.setQueryData(
                ["messages", agentId],
                (old: ContentWithUser[] = []) => [
                    ...old.filter((msg) => !msg.isLoading),
                    ...newMessages.map((msg) => ({
                        ...msg,
                        createdAt: Date.now(),
                    })),
                ]
            );
        },
        onError: (e) => {
            toast({
                variant: "destructive",
                title: "Unable to send message",
                description: e.message,
            });
        },
    });

    const messages =
        queryClient.getQueryData<ContentWithUser[]>(["messages", agentId]) ||
        [];

    return (
        <div className="flex flex-col w-full h-[calc(100dvh)] p-4">
            <div className="flex-1 overflow-y-auto bg-card rounded-t-md border-t border-l border-r">
                <ChatMessageList ref={messagesContainerRef}>
                    {/* Chat messages */}
                    <AnimatePresence>
                        {messages.map(
                            (message: ContentWithUser, index: number) => {
                                const variant = getMessageVariant(
                                    message?.user
                                );
                                return (
                                    <motion.div
                                        key={index}
                                        layout
                                        initial={{
                                            opacity: 0,
                                            scale: 1,
                                            y: 50,
                                            x: 0,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            y: 0,
                                            x: 0,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            scale: 1,
                                            y: 1,
                                            x: 0,
                                        }}
                                        transition={{
                                            opacity: { duration: 0.1 },
                                            layout: {
                                                type: "spring",
                                                bounce: 0.3,
                                                duration: index * 0.05 + 0.2,
                                            },
                                        }}
                                        style={{ originX: 0.5, originY: 0.5 }}
                                        className="flex flex-col gap-2 p-4"
                                    >
                                        <ChatBubble
                                            key={index}
                                            variant={variant}
                                            className="flex flex-row items-center gap-2"
                                        >
                                            {message?.user !== "user" ? (
                                                <Avatar className="size-8 p-1 border rounded-full">
                                                    <AvatarImage src="/elizaos-icon.png" />
                                                </Avatar>
                                            ) : null}
                                            <div className="flex flex-col">
                                                <ChatBubbleMessage
                                                    isLoading={
                                                        message?.isLoading
                                                    }
                                                >
                                                    {message?.user !==
                                                    "user" ? (
                                                        <AIWriter>
                                                            {message?.text}
                                                        </AIWriter>
                                                    ) : (
                                                        message?.text
                                                    )}

                                                    {/* Attachments */}
                                                    {/* <img
                                                        src="/elizaos.webp"
                                                        width="100%"
                                                        height="100%"
                                                        className="w-64 rounded-md mt-4"
                                                    /> */}
                                                </ChatBubbleMessage>
                                                <div className="flex items-center gap-4 justify-between w-full mt-1">
                                                    {message?.text &&
                                                    !message?.isLoading ? (
                                                        <div className="flex items-center gap-1">
                                                            <CopyButton
                                                                text={
                                                                    message?.text
                                                                }
                                                            />
                                                            <ChatTtsButton
                                                                agentId={
                                                                    agentId
                                                                }
                                                                text={
                                                                    message?.text
                                                                }
                                                            />
                                                        </div>
                                                    ) : null}

                                                    {message?.createdAt ? (
                                                        <ChatBubbleTimestamp
                                                            timestamp={moment(
                                                                message?.createdAt
                                                            ).format("LT")}
                                                            className={cn([
                                                                message?.isLoading
                                                                    ? "mt-2"
                                                                    : "",
                                                            ])}
                                                        />
                                                    ) : null}
                                                </div>
                                            </div>
                                        </ChatBubble>
                                    </motion.div>
                                );
                            }
                        )}
                    </AnimatePresence>
                </ChatMessageList>
            </div>
            <div className="px-4 pb-4 bg-card rounded-b-md border-b border-l border-r">
                <form
                    ref={formRef}
                    onSubmit={handleSendMessage}
                    className="relative rounded-md border bg-background"
                >
                    <ChatInput
                        ref={inputRef}
                        onKeyDown={handleKeyDown}
                        onChange={({ target }) => setInput(target.value)}
                        placeholder="Type your message here..."
                        className="min-h-12 resize-none rounded-md bg-background border-0 p-3 shadow-none focus-visible:ring-0"
                    />
                    <div className="flex items-center p-3 pt-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Paperclip className="size-4" />
                                    <span className="sr-only">Attach file</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <p>Attach file</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Mic className="size-4" />
                                    <span className="sr-only">
                                        Use Microphone
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Use microphone</p>
                            </TooltipContent>
                        </Tooltip>
                        <Button
                            disabled={!input || sendMessageMutation?.isPending}
                            type="submit"
                            size="sm"
                            className="ml-auto gap-1.5"
                        >
                            {sendMessageMutation?.isPending
                                ? "..."
                                : "Send Message"}
                            <CornerDownLeft className="size-3.5" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
