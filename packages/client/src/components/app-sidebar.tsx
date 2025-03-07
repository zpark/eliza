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
import { useAgents, useRooms } from "@/hooks/use-query-hooks";
import info from "@/lib/info.json";
import type { Agent } from "@elizaos/core";
import { Book, Cog, User, Scroll } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import ConnectionStatus from "./connection-status";
import { formatAgentName } from "@/lib/utils";
  
export function AppSidebar() {
  const location = useLocation();
  const { data: { data: agentsData } = {}, isPending: isAgentsPending } = useAgents();
  const { data: { data: roomsData } = {} } = useRooms();

  console.log(roomsData);
  return (
    <Sidebar className="bg-background">
      <SidebarHeader className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" className="px-6 py-4">
                <img
                  alt="elizaos-icon"
                  src="/elizaos-icon.png"
                  width="100%"
                  height="100%"
                  className="size-9"
                />

                <div className="flex flex-col leading-none ">
                  <span className="font-semibold text-lg">ElizaOS</span>
                  <span className="text-sm -mt-0.5 text-muted-foreground">v{info?.version}</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-2 pt-6">
            <div className="w-full h-full flex flex-col gap-6">
              {
                roomsData?.map((roomsData) => {
                  return <NavLink to={`/room/${roomsData.id}`}>
                    <div className="flex gap-2 items-center w-full cursor-pointer">
                        <div className="bg-muted rounded-lg w-12 h-12 flex justify-center items-center relative overflow-hidden">
                            {roomsData && (
                              <div className="text-lg text-ellipsis overflow-hidden whitespace-nowrap max-w-[3.5rem] text-center">
                                {formatAgentName(roomsData.name)}
                              </div>
                            )}
                        </div>
                        <div className=" truncate max-w-[100px]">{roomsData.name}</div>
                    </div>
                  </NavLink>
                })
              }
              </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink
              to="https://elizaos.github.io/eliza/docs/intro/"
              target="_blank"
            >
              <SidebarMenuButton className="text-muted-foreground rounded-md">
                <Book className="size-5" /> 
                <span>Documentation</span>
              </SidebarMenuButton>
            </NavLink>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavLink to="/logs">
              <SidebarMenuButton className="text-muted-foreground rounded-md">
                <Scroll className="size-5" /> 
                <span>Logs</span>
              </SidebarMenuButton>
            </NavLink>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton disabled className="text-muted-foreground/50 rounded-md">
              <Cog className="size-5" /> 
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <ConnectionStatus />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
  