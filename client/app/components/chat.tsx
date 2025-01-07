import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
    ChatBubble,
    ChatBubbleAction,
    ChatBubbleMessage,
} from "~/components/ui/chat/chat-bubble";
import { ChatInput } from "~/components/ui/chat/chat-input";
import { ChatMessageList } from "~/components/ui/chat/chat-message-list";
import { AnimatePresence, motion } from "framer-motion";
import {
    CopyIcon,
    CornerDownLeft,
    Paperclip,
    RefreshCcw,
    Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Content, UUID } from "@elizaos/core";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "~/lib/api";
import { type MessageExample } from "@elizaos/core";

const ChatAiIcons = [
    {
        icon: CopyIcon,
        label: "Copy",
    },
    {
        icon: RefreshCcw,
        label: "Refresh",
    },
    {
        icon: Volume2,
        label: "Volume",
    },
];

interface ExtraContentFields {
    user: string;
    createdAt: number;
}

type ContentWithUser = Content & ExtraContentFields;

export default function Page({ agentId }: { agentId: UUID }) {
    const [messages, setMessages] = useState<ContentWithUser[]>([]);
    const [input, setInput] = useState<string>("");

    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const getMessageVariant = (role: string) =>
        role !== "user" ? "received" : "sent";

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
                messagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input) return;

        sendMessageMutation.mutate(input);

        setMessages((messages: ContentWithUser[]) => [
            ...messages,
            {
                text: input,
                user: "user",
                createdAt: Date.now(),
            },
        ]);

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
        onSuccess(newMessages: ContentWithUser[]) {
            console.log({ newMessages });
            setMessages([
                ...messages,
                ...newMessages.map((a) => {
                    a.createdAt = Date.now();
                    return a;
                }),
            ]);
        },
    });

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
                                            className="flex flex-col"
                                        >
                                            <ChatBubbleMessage
                                                isLoading={false}
                                            >
                                                {message?.text}
                                            </ChatBubbleMessage>
                                            <span className="text-sm">
                                                {message?.createdAt}
                                            </span>
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
                        <Button variant="ghost" size="icon">
                            <Paperclip className="size-4" />
                            <span className="sr-only">Attach file</span>
                        </Button>

                        {/* <Button variant="ghost" size="icon">
                            <Mic className="size-4" />
                            <span className="sr-only">Use Microphone</span>
                        </Button> */}

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
