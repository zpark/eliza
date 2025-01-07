import { useQuery } from "@tanstack/react-query";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router";
import { type UUID } from "@elizaos/core";
import { formatAgentName } from "@/lib/utils";

export function AppSidebar() {
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
    });

    const agents = query?.data?.agents;

    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <NavLink to="/">
                        <SidebarGroupLabel>
                            <img
                                src="/elizaos.webp"
                                width="100%"
                                height="100%"
                                className="w-32"
                            />
                        </SidebarGroupLabel>
                    </NavLink>
                    <SidebarGroupLabel>Agents</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {agents?.map(
                                (agent: { id: UUID; name: string }) => (
                                    <SidebarMenuItem key={agent.id}>
                                        <NavLink to={`/chat/${agent.id}`}>
                                            <SidebarMenuButton>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 bg-muted rounded-md uppercase aspect-square grid place-items-center">
                                                        {formatAgentName(
                                                            agent.name
                                                        )}
                                                    </div>
                                                    <span>{agent.name}</span>
                                                </div>
                                            </SidebarMenuButton>
                                        </NavLink>
                                    </SidebarMenuItem>
                                )
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
