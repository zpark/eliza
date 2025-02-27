import { useQueryClient } from "@tanstack/react-query";
import { Plus, Play, RefreshCw, Settings } from "lucide-react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { characterNameToUrl, formatAgentName } from "@/lib/utils";
import { useCharacters, useStartAgent } from "@/hooks/use-query-hooks";
import { NavLink } from "react-router-dom";
import { CardActions } from "@/components/ui/card-actions";
import { ActionCard } from "@/components/ui/action-card";

export default function Characters() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    // Use custom hooks for data fetching and mutations
    const { 
      data: charactersData, 
      isLoading: isCharactersLoading, 
      isError: isCharactersError, 
      error: charactersError,
      isRefetching: isCharactersRefetching
    } = useCharacters();
    
    // Use the start agent mutation hook
    const startAgentMutation = useStartAgent();

    const characters = charactersData?.characters || [];

    // Handler to start an agent with a specific character
    const handleStartAgent = async (characterName: string) => {
        try {
            // Use the mutation hook which handles success/error states
            const response = await startAgentMutation.mutateAsync(characterName);
            
            // Navigate to the chat with the newly created agent on success
            if (response && response.id) {
                navigate(`/chat/${response.id}`);
            }
        } catch (error) {
            // Error is already handled by the mutation hook
            console.error("Failed to start agent:", error);
        }
    };

    // Function to refresh the characters list
    const refreshCharacters = () => {
        queryClient.invalidateQueries({ queryKey: ["characters"] });
    };

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <div className="flex items-center justify-between">
                <PageTitle title="Characters" />
                <NavLink to="/characters/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Character
                    </Button>
                </NavLink>
            </div>
            
            {isCharactersLoading && (
                <div className="text-center py-8">Loading characters...</div>
            )}
            
            {isCharactersError && (
                <div className="text-center py-8 text-destructive">
                    Error loading characters: {charactersError instanceof Error ? charactersError.message : "Unknown error"}
                </div>
            )}
            
            {!isCharactersLoading && characters.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No characters found on the server.
                </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {characters.map((character: { name: string }) => (
                    <ActionCard
                        key={character.name}
                        name={character.name}
                        primaryText="Start"
                        primaryIcon={<Play className="h-4 w-4" />}
                        primaryAction={() => handleStartAgent(character.name)}
                        secondaryIcon={<Settings className="h-4 w-4" />}
                        secondaryTitle="Edit character"
                        secondaryLink={`/characters/edit/${characterNameToUrl(character.name)}`}
                    />
                ))}
                
                {/* Card to create a new character */}
                <ActionCard
                    name=""
                    isSpecial
                    specialContent={
                        <Button 
                            variant="ghost" 
                            className="h-24 w-24 rounded-full"
                            onClick={() => navigate('/characters/new')}
                        >
                            <Plus className="h-12 w-12" />
                        </Button>
                    }
                />
            </div>
        </div>
    );
} 