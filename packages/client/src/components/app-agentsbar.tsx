import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import type { Agent } from "@elizaos/core";
import { NavLink, useLocation } from "react-router";
import { formatAgentName } from "@/lib/utils";
  
export function AppAgentsbar({ onlineAgents, offlineAgents, isLoading }: { onlineAgents: Agent[]; offlineAgents: Agent[], isLoading: boolean }) {
  const location = useLocation();
  return (
    <Sidebar side={"right"} className="bg-background">
      <SidebarContent>
        <SidebarGroup>
          {
            onlineAgents.length > 0 && (
              <>
                <SidebarGroupLabel className="px-6 py-6 text-sm font-medium text-muted-foreground">
                    Online
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  <SidebarMenu className="flex flex-col gap-3">
                    {
                      isLoading ? <div>
                        {Array.from({ length: 5 }).map((_, _index) => (
                          <SidebarMenuItem key={`skeleton-item-${_index}`}>
                            <SidebarMenuSkeleton />
                          </SidebarMenuItem>
                        ))}
                      </div> :
                        onlineAgents.map((agent) => (
                          <SidebarMenuItem key={agent.id}>
                            <NavLink to={`/chat/${agent.id}`}>
                              <SidebarMenuButton
                                isActive={location.pathname.includes(agent.id as string)}
                                className="transition-colors px-1 py-2 my-1 rounded-md"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-2 items-center h-full w-full p-4">
                                      <div className="bg-gray-500 rounded-full w-8 h-8 flex justify-center items-center relative">
                                          {agent && <div className="text-lg">{formatAgentName(agent.name)}</div>}
                                          <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-[1px] border-white bg-green-500`} />
                                      </div>
                                      <span className="text-base">{agent.name}</span>
                                  </div>
                                  
                                  
                                </div>
                              </SidebarMenuButton>
                            </NavLink>
                          </SidebarMenuItem>
                        ))
                    } 
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            )
          }
          {
            offlineAgents.length > 0 && (
              <>
                <SidebarGroupLabel className="px-6 pt-12 pb-6 text-sm font-medium text-muted-foreground">
                    Offline
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  <SidebarMenu className="flex flex-col gap-3">  
                      {offlineAgents.map((agent) => (
                        <SidebarMenuItem key={agent.id}>
                          <NavLink to={`/chat/${agent.id}`}>
                            <SidebarMenuButton
                              isActive={location.pathname.includes(agent.id as string)}
                              className="transition-colors px-1 py-2 my-1 rounded-md"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex gap-2 items-center h-full w-full p-4">
                                    <div className="bg-gray-500 rounded-full w-8 h-8 flex justify-center items-center relative">
                                        {agent && <div className="text-lg">{formatAgentName(agent.name)}</div>}
                                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-[1px] border-white bg-muted-foreground`} />
                                    </div>
                                    <span className="text-base">{agent.name}</span>
                                </div>
                              </div>
                            </SidebarMenuButton>
                          </NavLink>
                        </SidebarMenuItem>
                      ))}   
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            )
          }
          
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
  