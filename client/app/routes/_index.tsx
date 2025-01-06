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
    return (
        <div className="flex h-full">
            <Button>Hello World</Button>
        </div>
    );
}
