import { cn } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Activity, RefreshCw } from "lucide-react";
import { STALE_TIMES } from "@/hooks/use-query-hooks";

export default function ConnectionStatus() {
    const [queryTime, setQueryTime] = useState<number | null>(null);
    const [isTabVisible, setIsTabVisible] = useState<boolean>(true);
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const queryClient = useQueryClient();
    
    // Keep track of the last refresh time to limit window focus refetches
    const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
    
    // Listen for tab visibility and network status changes
    useEffect(() => {
      const handleVisibilityChange = () => {
        setIsTabVisible(document.visibilityState === 'visible');
      };
      
      const handleOnlineStatusChange = () => {
        setIsOnline(navigator.onLine);
      };
      
      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnlineStatusChange);
      window.addEventListener('offline', handleOnlineStatusChange);
      
      // Initial check
      setIsTabVisible(document.visibilityState === 'visible');
      
      // Clean up listeners
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnlineStatusChange);
        window.removeEventListener('offline', handleOnlineStatusChange);
      };
    }, []);
    
    // Dynamic poll interval based on tab visibility and online status
    const getPollInterval = () => {
      if (!isOnline) return false; // Don't poll when offline
      if (!isTabVisible) return 30000; // 30s when tab is not visible
      return 5000; // 5s when tab is visible
    };

    const query = useQuery({
        queryKey: ["status"],
        queryFn: async () => {
            const start = performance.now();
            const data = await apiClient.getAgents();
            const end = performance.now();
            setQueryTime(end - start);
            setLastRefreshTime(Date.now());
            return data;
        },
        refetchInterval: getPollInterval(),
        retry: 1,
        retryDelay: attemptIndex => Math.min(1000 * (1.5 ** attemptIndex), 10000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // Fail quickly for status checks
        staleTime: 0
    });

    const connected = query?.isSuccess && !query?.isError;
    const isLoading = query?.isRefetching || query?.isPending;
    
    // Show the connection status color with the network status
    const getStatusColor = () => {
      if (!isOnline) return "bg-orange-600"; // Orange for offline
      if (isLoading) return "bg-muted-foreground";
      return connected ? "bg-green-600" : "bg-red-600";
    };
    
    // Show the connection status text
    const getStatusText = () => {
      if (!isOnline) return "Offline";
      if (isLoading) return "Connecting...";
      return connected ? "Connected" : "Disconnected";
    };
    
    // Get the text color based on status
    const getTextColor = () => {
      if (!isOnline) return "text-orange-600";
      if (isLoading) return "text-muted-foreground";
      return connected ? "text-green-600" : "text-red-600";
    };

    // Function to refresh agents and status
    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["status"] });
    };

    return (
        <SidebarMenuItem>
            <Tooltip>
                <TooltipTrigger asChild>
                    <SidebarMenuButton
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={refreshData}
                    >
                        <div className="flex flex-col gap-1 select-none transition-all duration-200">
                            <div className="flex items-center gap-1">
                                {isHovered ? (
                                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                                ) : (
                                    <div
                                        className={cn([
                                            "h-2.5 w-2.5 rounded-full",
                                            getStatusColor()
                                        ])}
                                    />
                                )}
                                <span
                                    className={cn([
                                        "text-xs",
                                        isHovered ? "text-muted-foreground" : getTextColor()
                                    ])}
                                >
                                    {isHovered ? "Refresh" : getStatusText()}
                                </span>
                            </div>
                        </div>
                    </SidebarMenuButton>
                </TooltipTrigger>
                {connected && !isHovered ? (
                    <TooltipContent side="top">
                        <div className="flex items-center gap-1">
                            <Activity className="size-4" />
                            <span>{queryTime?.toFixed(2)} ms</span>
                        </div>
                    </TooltipContent>
                ) : null}
            </Tooltip>
        </SidebarMenuItem>
    );
}
