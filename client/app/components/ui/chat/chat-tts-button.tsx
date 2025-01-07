import { Ellipsis, StopCircle, Volume2 } from "lucide-react";
import { Button } from "../button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "~/lib/api";
import { Tooltip, TooltipTrigger, TooltipContent } from "../tooltip";

export default function ChatTtsButton({
    agentId,
    text,
}: {
    agentId: string;
    text: string;
}) {
    const [playing, setPlaying] = useState<boolean>(false);
    const mutation = useMutation({
        mutationKey: ["tts", text],
        mutationFn: () => apiClient.speak(agentId, ""),
        onSuccess: (data) => {
            console.log(data);
            setPlaying(true);
        },
        onError: (e) => {
            console.error(e.message);
        },
    });

    const execute = () => {
        if (mutation?.isPending) return;
        if (playing) {
            setPlaying(false);
        }

        mutation.mutate();
    };

    const iconClass = "text-muted-foreground size-4";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => execute()}
                    disabled={mutation?.isPending}
                >
                    {mutation?.isPending ? (
                        <Ellipsis className={iconClass} />
                    ) : playing ? (
                        <StopCircle className={iconClass} />
                    ) : (
                        <Volume2 className={iconClass} />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>Read aloud</p>
            </TooltipContent>
        </Tooltip>
    );
}
