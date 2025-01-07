import { DotSquare, Ellipsis, StopCircle, Volume2 } from "lucide-react";
import { Button } from "../button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "~/lib/api";

export default function ChatTtsButton({ agentId, text }: { agentId: string; text: string }) {
    const [playing, setPlaying] = useState<boolean>(false);
    const mutation = useMutation({
        mutationKey: ["tts", text],
        mutationFn: () => apiClient.speak(agentId, text),
        onSuccess: () => {
            setPlaying(true);
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
        <Button
            size="icon"
            variant="ghost"
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
    );
}
