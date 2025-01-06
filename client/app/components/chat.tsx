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
import { UUID } from "@elizaos/core";

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

export default function Page({ agentId }: { agentId: UUID }) {
    const [messages, setMessages]: any[] = useState([]);
    const selectedUser = {
        name: "AAA",
        avatar: null,
    };
    const [input, setInput] = useState("");
    const [isLoading, setisLoading] = useState(false);

    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const getMessageVariant = (role: string) =>
        role === "ai" ? "received" : "sent";
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

        setMessages((messages) => [
            ...messages,
            {
                id: messages.length + 1,
                avatar: selectedUser.avatar,
                name: selectedUser.name,
                role: "user",
                message: input,
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

    return (
        <div className="flex flex-col w-full h-[calc(100dvh)] p-4">
            <div className="flex-1 overflow-y-auto bg-card rounded-t-md border-t border-l border-r">
                <ChatMessageList ref={messagesContainerRef}>
                    {/* Chat messages */}
                    <AnimatePresence>
                        {messages.map((message, index) => {
                            const variant = getMessageVariant(message.role!);
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
                                    exit={{ opacity: 0, scale: 1, y: 1, x: 0 }}
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
                                    <ChatBubble key={index} variant={variant}>
                                        <Avatar>
                                            <AvatarImage
                                                src={
                                                    message.role === "ai"
                                                        ? ""
                                                        : message.avatar
                                                }
                                                alt="Avatar"
                                                className={
                                                    message.role === "ai"
                                                        ? "dark:invert"
                                                        : ""
                                                }
                                            />
                                            <AvatarFallback>
                                                {message.role === "ai"
                                                    ? "🤖"
                                                    : "GG"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <ChatBubbleMessage
                                            isLoading={message.isLoading}
                                        >
                                            {message.message}
                                            {message.role === "ai" && (
                                                <div className="flex items-center mt-1.5 gap-1">
                                                    {!message.isLoading && (
                                                        <>
                                                            {ChatAiIcons.map(
                                                                (
                                                                    icon,
                                                                    index
                                                                ) => {
                                                                    const Icon =
                                                                        icon.icon;
                                                                    return (
                                                                        <ChatBubbleAction
                                                                            variant="outline"
                                                                            className="size-6"
                                                                            key={
                                                                                index
                                                                            }
                                                                            icon={
                                                                                <Icon className="size-3" />
                                                                            }
                                                                            onClick={() =>
                                                                                console.log(
                                                                                    "Action " +
                                                                                        icon.label +
                                                                                        " clicked for message " +
                                                                                        index
                                                                                )
                                                                            }
                                                                        />
                                                                    );
                                                                }
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </ChatBubbleMessage>
                                    </ChatBubble>
                                </motion.div>
                            );
                        })}
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
                            disabled={!input || isLoading}
                            type="submit"
                            size="sm"
                            className="ml-auto gap-1.5"
                        >
                            Send Message
                            <CornerDownLeft className="size-3.5" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
