import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";

export default function NewCharacter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [character, setCharacter] = useState({
        name: "",
        username: "",
        system: "",
        bio: [] as string[],
        topics: [] as string[],
        adjectives: [] as string[],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCharacter(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Format the bio, topics, and adjectives as arrays
            const bioArray = character.bio.length > 0 ? character.bio : character.system.split('\n').filter(line => line.trim());
            
            const characterData = {
                ...character,
                bio: bioArray,
                topics: character.topics.length > 0 ? character.topics : [],
                adjectives: character.adjectives.length > 0 ? character.adjectives : [],
            };

            await apiClient.createCharacter(characterData);
            
            // Invalidate the characters query to refresh the characters list
            queryClient.invalidateQueries({ queryKey: ["characters"] });
            
            toast({
                title: "Success",
                description: "Character created successfully!",
            });
            
            navigate("/characters");
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create character",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <PageTitle title="Create New Character" />
            
            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Character Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                value={character.name}
                                onChange={handleChange}
                                placeholder="Character's display name"
                                required
                            />
                            <p className="text-sm text-muted-foreground">The display name for your character</p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                value={character.username}
                                onChange={handleChange}
                                placeholder="unique-username"
                                required
                            />
                            <p className="text-sm text-muted-foreground">A unique identifier for your character (no spaces or special characters)</p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="system">System Prompt</Label>
                            <Textarea
                                id="system"
                                name="system"
                                value={character.system}
                                onChange={handleChange}
                                placeholder="Describe your character's behavior and personality..."
                                className="min-h-[150px]"
                                required
                            />
                            <p className="text-sm text-muted-foreground">System prompt that defines your character's personality and behavior</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => navigate("/characters")}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating..." : "Create Character"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
} 