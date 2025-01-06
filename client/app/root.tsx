import {
    Links,
    LiveReload,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "~/components/ui/sidebar";
import type { LinksFunction } from "@remix-run/node";

import "./tailwind.css";
import { AppSidebar } from "./components/app-sidebar";

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

const queryClient = new QueryClient();

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            className="dark"
            style={{
                colorScheme: "dark",
            }}
        >
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
            </head>

            <body>
                <QueryClientProvider client={queryClient}>
                    <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                            <div className="flex flex-1 flex-col gap-4 size-full">
                                {children}
                            </div>
                        </SidebarInset>
                    </SidebarProvider>
                </QueryClientProvider>
            </body>
            <ScrollRestoration />
            <Scripts />
        </html>
    );
}

export default function App() {
    return <Outlet />;
}
