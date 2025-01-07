import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

const CopyButton = ({ text }: { text: any }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        });
    };

    return (
        <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="flex items-center space-x-2 text-muted-foreground"
        >
            {copied ? (
                <Check className="size-4" />
            ) : (
                <Copy className="size-4" />
            )}
        </Button>
    );
};

export default CopyButton;
