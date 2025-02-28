import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
  } from "@/components/ui/sidebar";
  import { useAgents } from "@/hooks/use-query-hooks";
  import info from "@/lib/info.json";
  import type { UUID } from "@elizaos/core";
  import { Book, Cog, User } from "lucide-react";
  import { NavLink, useLocation } from "react-router";
  import ConnectionStatus from "./connection-status";
  
  export function AppSidebar() {
    const location = useLocation();
  
    const { data: agentsData, isPending: isAgentsPending } = useAgents();
  
    return (
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <NavLink to="/">
                  <img
                    alt="elizaos-icon"
                    src="/elizaos-icon.png"
                    width="100%"
                    height="100%"
                    className="size-7"
                  />
  
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">ElizaOS</span>
                    <span className="">v{info?.version}</span>
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Agents</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAgentsPending ? (
                  <div>
                    {Array.from({ length: 5 }).map((_, _index) => (
                      <SidebarMenuItem key={`skeleton-item-${_index}`}>
                        <SidebarMenuSkeleton />
                      </SidebarMenuItem>
                    ))}
                  </div>
                ) : (
                  <div>
                    {agentsData?.agents?.map(
                      (agent) => (
                        <SidebarMenuItem key={agent.id}>
                          <NavLink to={`/chat/${agent.id}`}>
                            <SidebarMenuButton
                              isActive={location.pathname.includes(agent.id)}
                            >
                              <User />
                              <span>{agent.character.name}</span>
                            </SidebarMenuButton>
                          </NavLink>
                        </SidebarMenuItem>
                      )
                    )}
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <NavLink
                to="https://elizaos.github.io/eliza/docs/intro/"
                target="_blank"
              >
                <SidebarMenuButton>
                  <Book /> Documentation
                </SidebarMenuButton>
              </NavLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton disabled>
                <Cog /> Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
            <ConnectionStatus />
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
  }
  