import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Chat from "./routes/chat";
import Overview from "./routes/overview";
import Home from "./routes/home";
import Characters from "./routes/characters";
import NewCharacter from "./routes/new-character";
import useVersion from "./hooks/use-version";
import AgentStatusListener from "./components/agent-status-listener";
import { useEffect } from "react";
import { apiClient } from "./lib/api";
import { STALE_TIMES } from "./hooks/use-query-hooks";
import EditCharacter from "./routes/edit-character";

// Create a query client with optimized settings
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_TIMES.STANDARD,
            // Default to no polling unless specifically configured
            refetchInterval: false,
            // Make queries retry 3 times with exponential backoff
            retry: 3,
            retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 30000),
            // Refetch query on window focus
            refetchOnWindowFocus: true,
            // Don't refetch on reconnect since we use SSE
            refetchOnReconnect: false,
            // Fail queries that take too long
        },
        mutations: {
            // Default to 3 retries for mutations too
            retry: 3,
            retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 30000),
        },
    },
});

// Prefetch initial data with smarter error handling
const prefetchInitialData = async () => {
  try {
    // Prefetch characters
    await queryClient.prefetchQuery({
      queryKey: ["characters"],
      queryFn: () => apiClient.getCharacters(),
      staleTime: STALE_TIMES.STANDARD,
    });
    
    // Prefetch agents (real-time data so shorter stale time)
    await queryClient.prefetchQuery({
      queryKey: ["agents"],
      queryFn: () => apiClient.getAgents(),
      staleTime: STALE_TIMES.NEVER, // Rely on SSE for updates
    });
  } catch (error) {
    console.error("Error prefetching initial data:", error);
    // Don't throw, let the app continue loading with fallbacks
  }
};

// Execute prefetch immediately
prefetchInitialData();

function App() {
    useVersion();
    
    // Also prefetch when the component mounts (helps with HMR and refreshes)
    useEffect(() => {
      prefetchInitialData();
    }, []);
    
    return (
        <QueryClientProvider client={queryClient}>
            <div
                className="dark antialiased"
                style={{
                    colorScheme: "dark",
                }}
            >
                <BrowserRouter>
                    <TooltipProvider delayDuration={0}>
                        <SidebarProvider>
                            <AppSidebar />
                            <SidebarInset>
                                <div className="flex flex-1 flex-col gap-4 size-full container">
                                    <Routes>
                                        <Route path="/" element={<Home />} />
                                        <Route path="/characters" element={<Characters />} />
                                        <Route path="/characters/new" element={<NewCharacter />} />
                                        <Route path="/characters/edit/:characterName" element={<EditCharacter />} />
                                        <Route
                                            path="chat/:agentId"
                                            element={<Chat />}
                                        />
                                        <Route
                                            path="settings/:agentId"
                                            element={<Overview />}
                                        />
                                    </Routes>
                                </div>
                            </SidebarInset>
                        </SidebarProvider>
                        <Toaster />
                        <AgentStatusListener />
                    </TooltipProvider>
                </BrowserRouter>
            </div>
        </QueryClientProvider>
    );
}

export default App;
