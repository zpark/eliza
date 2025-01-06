import type { MetaFunction } from "@remix-run/node";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { apiClient } from "~/lib/api";

export const meta: MetaFunction = () => {
    return [
        { title: "New Remix App" },
        { name: "description", content: "Welcome to Remix!" },
    ];
};

export default function Index() {
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents()
    });

    console.log(query)

    return (
        <div className="flex h-screen items-center justify-center">
            <Button>Hello World</Button>
        </div>
    );
}