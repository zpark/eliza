import type { MetaFunction } from "@remix-run/node";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "~/components/page-title";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
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
        queryFn: () => apiClient.getAgents(),
    });

    const agents = query?.data?.agents;

    return (
        <div className="flex flex-col gap-4 h-full">
            <PageTitle title="Agents" />
            <div className="grid grid-cols-2 md:grid-cols-4">
                {agents?.map((agent) => (
                    <Card>
                        <CardHeader>
                            <CardTitle>{agent?.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg bg-muted aspect-square w-full grid place-items-center">
                                <div className="text-6xl font-bold uppercase">
                                    {agent?.name?.substring(0, 2)}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full">
                                Chat
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
