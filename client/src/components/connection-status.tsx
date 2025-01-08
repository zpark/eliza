import { cn } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export default function ConnectionStatus() {
    const query = useQuery({
        queryKey: ["status"],
        queryFn: () => apiClient.getAgents(),
    });

    const connected = query?.data;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild>
                <div className="flex items-center gap-1 select-none transition-all duration-200">
                    <div
                        className={cn([
                            "h-2.5 w-2.5 rounded-full",
                            connected ? "bg-green-600" : "bg-red-600",
                        ])}
                    />
                    <span
                        className={cn([
                            "text-xs",
                            connected ? "text-green-600" : "text-red-600",
                        ])}
                    >
                        {connected ? "Connected to server" : "Disconnected"}
                    </span>
                </div>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
