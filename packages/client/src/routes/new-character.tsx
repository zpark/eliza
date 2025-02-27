import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import PageTitle from "@/components/page-title";
import type { Character } from "@elizaos/core";
import { apiClient } from "@/lib/api";
import CharacterForm from "@/components/character-form";

const defaultCharacter = {
    name: "",
    username: "",
    system: "",
    bio: [] as string[],
    topics: [] as string[],
    adjectives: [] as string[],
}

export default function NewCharacter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [character, setCharacter] = useState({...defaultCharacter});

    const ensureRequiredFields = (character: Character): Character => {
        // Clone character to avoid mutating original
        const completedCharacter = { ...character };
        
        // Ensure all required fields are present
        if (!completedCharacter.name) throw new Error("name field is required");
        if (!completedCharacter.bio) throw new Error("bio field is required");
        if (!completedCharacter.messageExamples) completedCharacter.messageExamples = [];
        if (!completedCharacter.postExamples) completedCharacter.postExamples = [];
        if (!completedCharacter.topics) completedCharacter.topics = [];
        if (!completedCharacter.adjectives) completedCharacter.adjectives = [];
        if (!completedCharacter.plugins) completedCharacter.plugins = [];
        
        // Ensure style field exists
        if (!completedCharacter.style) {
          completedCharacter.style = { all: [], chat: [], post: [] };
        }
        
        return completedCharacter;
      };

    

    const handleSubmit = async (character: Character) => {
        setIsSubmitting(true);

        try {
            const completeCharacter = ensureRequiredFields(character);
            await apiClient.createCharacter(completeCharacter);

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
            <CharacterForm
                character={character}
                title="Create Character"
                description={`Create character`}
                onSubmit={handleSubmit}
                onCancel={() => navigate('/characters')}
                deleteButtonText="Delete Character"
                submitButtonText="Save Changes"
            />
           
        </div>
    );
} 